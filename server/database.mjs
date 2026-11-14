import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';

export const importMarker='sqlite-v6';
export const schemaMarker='mongo-schema-v1';
export const dataCollections=['pilots','sessions','runs','economy_ledger','cosmetics'];
export function loadDatabaseEnv(){
  try{loadEnvFile(fileURLToPath(new URL('../.env',import.meta.url)));}catch(error){if(error.code!=='ENOENT')throw error;}
}
export function mongoConnectionMessage(error){
  const errors=[error,...Array.from(error?.reason?.servers?.values?.()??[],server=>server.error)].filter(Boolean);
  for(const item of [...errors])if(item.cause)errors.push(item.cause);
  if(errors.some(e=>['MongoParseError','MongoInvalidArgumentError'].includes(e.name)))
    return 'La URI de MongoDB es inválida. Copia la URI de Atlas y codifica los caracteres especiales de las credenciales.';
  if(errors.some(e=>e.code===18||e.codeName==='AuthenticationFailed'||/bad auth|authentication failed/i.test(e.message)))
    return 'Atlas rechazó la autenticación. Revisa el usuario y la contraseña en Database Access y actualiza MONGODB_URI.';
  if(errors.some(e=>e.code===13||e.codeName==='Unauthorized'))
    return 'El usuario de MongoDB no tiene acceso a la base indicada. Revisa MONGODB_DB y sus permisos en Database Access.';
  if(errors.some(e=>/^query(?:Srv|Txt)$/.test(e.syscall??'')||['ENOTFOUND','ENODATA','EAI_AGAIN'].includes(e.code)))
    return 'Falló la resolución DNS de MongoDB. Verifica el nombre del clúster y que esté activo. Si tu DNS bloquea consultas SRV, copia la URI estándar (mongodb://) desde Atlas.';
  if(errors.some(e=>/^ERR_(?:SSL|TLS)_/.test(e.code??'')||/certificate|tlsv1 alert|ssl alert/i.test(e.message)))
    return 'Falló la conexión TLS con MongoDB. Verifica que la IP pública de este equipo esté permitida en Atlas y revisa la VPN, el proxy o los certificados de la red.';
  return 'No se pudo establecer conexión con MongoDB. Verifica que el clúster esté activo, que Atlas permita tu IP pública y que tu red permita el puerto del clúster (habitualmente 27017).';
}
export async function connectMongo(){
  const uri=process.env.MONGODB_URI?.trim(),name=process.env.MONGODB_DB?.trim()||'touge_after_hours';
  if(!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri))throw Error('Configura MONGODB_URI con la URI del controlador de MongoDB.');
  if(!/^[a-zA-Z0-9_-]{1,63}$/.test(name)||['admin','local','config'].includes(name.toLowerCase()))throw Error('Configura MONGODB_DB con un nombre de base dedicado al juego.');
  const {MongoClient}=await import('mongodb');
  let client;
  try{
    client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,connectTimeoutMS:10000,waitQueueTimeoutMS:12000,socketTimeoutMS:60000,promoteBuffers:true,maxPoolSize:24});
    await client.connect();
    const db=client.db(name);
    await db.command({ping:1});
    return {client,db};
  }catch(error){
    await client?.close();
    throw Error(mongoConnectionMessage(error));
  }
}
export async function prepareMongo(db){
  await db.collection('pilots').createIndex({username_key:1},{unique:true});
  await ensureEmailIndex(db);
  await db.collection('sessions').createIndex({expires_at:1},{expireAfterSeconds:0});
  const runs=db.collection('runs');
  await runs.createIndex({handling:1,track:1,source:1,wet:1,night:1,manual:1,completed:1,elapsed:1,created_at:1,_id:1});
  await runs.createIndex({user_id:1,handling:1,track:1,car:1,build_key:1,completed:1,elapsed:1});
  await db.collection('economy_ledger').createIndex({user_id:1,run_id:1});
}
export function ensureEmailIndex(db){
  return db.collection('pilots').createIndex({email:1},{unique:true,partialFilterExpression:{email:{$type:'string'}}});
}
export async function ensureMongoSchema(client,db){
  const migrations=db.collection('migrations');
  const ready={_id:{$in:[importMarker,schemaMarker]}};
  if(await migrations.findOne(ready,{projection:{_id:1}}))return;
  const requireEmpty=async session=>{
    for(const name of ['migrations',...dataCollections]){
      if(await db.collection(name).findOne({},{session,projection:{_id:1}}))
        throw Error('La base tiene datos sin una inicialización reconocida. Usa una base nueva o completa la importación de SQLite.');
    }
  };
  await requireEmpty();
  await prepareMongo(db);
  try{await db.createCollection('migrations');}catch(error){if(error.code!==48)throw error;}
  try{
    await client.withSession(session=>session.withTransaction(async()=>{
      if(await migrations.findOne(ready,{session,projection:{_id:1}}))return;
      await requireEmpty(session);
      await migrations.insertOne({_id:schemaMarker,initialized_at:new Date(),source:'empty'},{session});
    },{writeConcern:{w:'majority'}}));
  }catch(error){
    if(error.code!==11000||!await migrations.findOne(ready,{projection:{_id:1}}))throw error;
  }
}
export async function openStore(){
  const backend=process.env.NODE_TEST_CONTEXT?'sqlite':process.env.DB_BACKEND?.trim()||'sqlite';
  if(backend==='sqlite'){
    const {Store}=await import('./store.mjs');
    return new Store();
  }
  if(backend!=='mongodb')throw Error('DB_BACKEND debe ser sqlite o mongodb.');
  const {client,db}=await connectMongo();
  try{
    await ensureMongoSchema(client,db);
    await ensureEmailIndex(db);
    const {MongoStore}=await import('./mongo-store.mjs');
    return new MongoStore(client,db);
  }catch(error){
    await client.close();
    if(isMongoError(error))throw Error(mongoConnectionMessage(error));
    throw error;
  }
}
export const isMongoError=error=>/^Mongo/.test(error?.name??'');
export const databaseUnavailable='La base de datos no está disponible. Intenta de nuevo en unos segundos.';
