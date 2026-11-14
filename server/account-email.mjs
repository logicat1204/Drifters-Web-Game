export function emailAddress(value){
  const email=typeof value==='string'?value.trim().toLowerCase():'';
  const [local,domain]=email.split('@');
  if(email.length>254||!domain||local.length>64||local.includes('..')||!/^[-a-z0-9!#$%&'*+/=?^_`{|}~.]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)||local.startsWith('.')||local.endsWith('.')||domain.split('.').some(part=>part.length>63||part.startsWith('-')||part.endsWith('-'))){
    throw Error('Escribe un correo electrónico válido.');
  }
  return email;
}

export const duplicateEmail=()=>Object.assign(Error('Ese correo ya está vinculado a una cuenta.'),{status:409});
export const invalidCredentials=()=>Object.assign(Error('Los datos de acceso o la contraseña son incorrectos.'),{status:401});
export const emailAlreadyLinked=()=>Object.assign(Error('Esta cuenta ya tiene un correo vinculado.'),{status:409});
