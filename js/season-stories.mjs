// Readable narrative fallback. Custom comic pages in the season folders override it.
export function seasonDialogue(stage,ending=false){
 const place=stage.team||stage.name,name=stage.short||stage.name;
 if(stage.season==='rain')return ending?[
  `${name}: Esta vez no bastaba con conocer la carretera. Has sabido escuchar el agarre que quedaba.`,
  stage.index===23?'Has vencido a todos bajo la lluvia. Japón reconoce a su piloto más rápido. Ahora los rivales regresarán para arrebatarte el título.':`La lluvia sigue cayendo sobre ${place}. Otra victoria queda escrita en tu licencia; la siguiente montaña ya te espera.`
 ]:[
  `Vuelves a ${place}. El asfalto refleja las luces y el ruido de la lluvia cambia el pulso de la montaña.`,
  `${name}: Ya me venciste en nuestra primera carrera. Hoy las referencias de frenada son otras. Demuéstrame que tu victoria no dependía del tiempo.`
 ];
 return ending?[
  `${name}: Ahora entiendo por qué todos vienen a buscarte. Hoy el título sigue siendo tuyo.`,
  stage.index===23?'Has defendido el trono en todas las regiones. La historia está completa: sigues siendo el piloto más rápido de Japón. Puedes volver a estos duelos con su dificultad final.':`Defensa completada en ${place}. Tus rivales conocen tu nombre; todavía quedan aspirantes esperando su oportunidad.`
 ]:[
  `Tu nombre ya recorre Japón. En ${place} no llega un desconocido: llega la persona a la que todos quieren vencer.`,
  `${name}: No he venido a recordar nuestra derrota. He trabajado mi trazada para quitarte el primer puesto. Esta vez tú tienes algo que defender.`
 ];
}
export function seasonChapterDialogue(chapter,ending=false){
 if(ending&&chapter.id==='manazuru')return chapter.season==='rain'?['La temporada lluviosa ha terminado. Has vuelto a superar todos los desafíos de Japón.','NG+ está disponible. Ahora eres el campeón: tus rivales regresan para disputar tu trono.']:['El último aspirante ha sido derrotado. Has defendido el título en todas las regiones.','Tu historia está completa. Conservas tus coches, tus premios y estos duelos con su dificultad final. No hay otro ciclo obligatorio.'];
 if(chapter.season==='rain')return ending?[`La revancha de ${chapter.name} termina entre lluvia y faros. Has superado a sus pilotos en condiciones distintas.`,`La temporada continúa. La confianza ayuda, pero en la siguiente región tendrás que volver a encontrar el límite.`]:[`Temporada lluviosa · ${chapter.name}. Las victorias anteriores han despertado a tus rivales.`,`Regresas con tus coches y tu experiencia. El agua obliga a cambiar las referencias y a dosificar cada salida de curva.`];
 return ending?[`Has defendido tu puesto frente a todos los aspirantes de ${chapter.name}.`,`El trono sigue siendo tuyo. Cada región que completas acerca el desenlace de tu historia.`]:[`NG+ · ${chapter.name}. Tu reputación llega antes que el sonido de tu motor.`,`Los pilotos de esta región se han preparado para desafiar al campeón. Mantén la calma y defiende tu título con una trazada limpia.`];
}
