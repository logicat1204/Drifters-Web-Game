import {parseArgs} from 'node:util';
import {getBuiltinModule} from 'node:process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {connectMongo,dataCollections,importMarker,isMongoError,loadDatabaseEnv,mongoConnectionMessage,prepareMongo} from '../server/database.mjs';

export function readSqlite(filename){
  if(filename===':memory:'||!existsSync(filename))throw Error('No se encontró SQLite. Indica la ruta con --source.');
  const {DatabaseSync}=getBuiltinModule('node:sqlite');
  const sql=new DatabaseSync(filename,{readOnly:true});
  const rows=table=>sql.prepare('SELECT * FROM '+table).all();
  try{
    sql.exec('BEGIN');
    if(![6,7].includes(sql.prepare('PRAGMA user_version').get().user_version))throw Error('La copia SQLite debe tener el esquema v6 o v7. Ábrela primero con la versión actual del servidor.');
    if(sql.prepare('PRAGMA quick_check').get().quick_check!=='ok'||sql.prepare('PRAGMA foreign_key_check').get())throw Error('SQLite tiene errores de integridad. Usa una copia consistente.');
    const users=rows('users'),profiles=new Map(rows('profiles').map(({user_id,...row})=>[user_id,row]));
    const balances=new Map(rows('wallets').map(row=>[row.user_id,row.balance]));
    const pilots=users.map(({id,...user})=>{
      const profile=profiles.get(id);
      if(!profile||!balances.has(id))throw Error('Hay usuarios sin perfil o saldo. Revisa la copia SQLite.');
      const photo=profile.photo?Buffer.from(profile.photo):null;
      return {_id:id,...user,username_key:user.username.toLowerCase(),profile:{...profile,avatar:JSON.parse(profile.avatar),photo,has_photo:!!photo},
        balance:balances.get(id),inventory:[],cars:[],builds:[],parts:[],music:[],stories:[],campaign:[]};
    });
    const byId=new Map(pilots.map(pilot=>[pilot._id,pilot]));
    for(const [field,table] of Object.entries({inventory:'inventory',cars:'owned_cars',builds:'vehicle_builds',parts:'owned_vehicle_parts',music:'owned_music',stories:'chapter_story_seen',campaign:'campaign_progress'})){
      for(const {user_id,...row} of rows(table))byId.get(user_id)[field].push(row);
    }
    return {
      pilots,sessions:rows('sessions').map(({token_hash,expires_at,...row})=>({_id:token_hash,...row,expires_at:new Date(expires_at)})),
      runs:rows('runs').map(({id,...row})=>({_id:id,...row})),
      economy_ledger:rows('economy_ledger').map(({id,...row})=>({_id:id,...row})),
      cosmetics:rows('cosmetics').map(({id,...row})=>({_id:id,...row}))
    };
  }finally{sql.close();}
}

export async function importSqlite(client,db,data){
  const migrations=db.collection('migrations');
  async function requireEmpty(session){
    const options={session,projection:{_id:1}};
    if(await migrations.findOne({},options))throw Error('MongoDB ya tiene una migración. Usa otra base de datos para evitar duplicar los datos.');
    for(const name of dataCollections){
      if(await db.collection(name).findOne({},options))throw Error('MongoDB ya contiene datos del juego. Elige una base nueva para la importación.');
    }
  }
  await requireEmpty();
  await prepareMongo(db);
  // Explicitly materialize every collection before the transaction, including empty collections.
  for(const name of ['migrations',...dataCollections]){
    try{await db.createCollection(name);}catch(error){if(error.code!==48)throw error;}
  }
  const counts=Object.fromEntries(dataCollections.map(name=>[name,data[name].length]));
  await client.withSession(session=>session.withTransaction(async()=>{
    await requireEmpty(session);
    await migrations.insertOne({_id:importMarker,imported_at:new Date(),counts},{session});
    for(const name of dataCollections){
      if(data[name].length)await db.collection(name).insertMany(data[name],{session,ordered:true});
    }
  },{writeConcern:{w:'majority'},timeoutMS:55000}));
}

async function main(){
  const {values}=parseArgs({options:{'dry-run':{type:'boolean'},apply:{type:'boolean'},check:{type:'boolean'},source:{type:'string'}}});
  if(Number(!!values['dry-run'])+Number(!!values.apply)+Number(!!values.check)>1)throw Error('Usa solo uno de --dry-run, --apply y --check.');
  loadDatabaseEnv();
  if(values.check){
    const {client,db}=await connectMongo();
    try{
      await db.collection('migrations').findOne({_id:importMarker},{projection:{_id:1}});
    }catch(error){throw Error(mongoConnectionMessage(error));}
    finally{await client.close();}
    console.log('Conexión y acceso de lectura a MongoDB verificados.');
    return;
  }
  const {sqlitePath}=await import('../server/store.mjs');
  const data=readSqlite(values.source||sqlitePath());
  console.table(Object.fromEntries(dataCollections.map(name=>[name,data[name].length])));
  if(!values.apply){console.log('Lectura de SQLite completada. Usa --apply para importar a MongoDB.');return;}
  const {client,db}=await connectMongo();
  try{await importSqlite(client,db,data);}finally{await client.close();}
  console.log('Importación completada. Ya puedes configurar DB_BACKEND=mongodb.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await main();}catch(error){
    console.error(isMongoError(error)?'La importación no se pudo completar. Revisa los permisos de lectura y escritura, el soporte de transacciones y la conexión. Si se interrumpió al confirmar, comprueba la marca de importación con un nuevo intento.':error.message);
    process.exitCode=1;
  }
}
