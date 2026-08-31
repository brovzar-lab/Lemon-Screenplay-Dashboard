---
name: titulo-comercial
description: >
  Generador de títulos comerciales para películas y series en español, con foco en el mercado mexicano y viaje al streaming hispanohablante. Úsalo cuando el usuario quiera brainstormar títulos para un proyecto, con o sin material de base. Triggered on: "dame títulos," "necesito un título," "brainstorm títulos," "cómo se podría llamar," "título comercial," "título para esta película," "título para esta comedia," "qué título le pondrías," "título-comercial," o cualquier momento en que se busque nombrar un proyecto de cine o serie. También activa cuando el usuario describe una idea, premisa, tratamiento, o guion y no ha mencionado un título todavía — ofrecer títulos es siempre útil aunque no se pida explícitamente.
---

# Título Comercial

Generador de títulos para proyectos de cine y televisión. Prioridad: comedia mexicana para taquilla y streaming hispanohablante.

---

## Por qué funcionan los títulos comerciales en México

Los títulos más exitosos de la comedia mexicana comparten un patrón claro:

**Contenedor lingüístico familiar + giro.** Toman una frase que ya vive en la memoria del público — un rezo, un voto, un dicho, un término de slang — y le vierten una historia nueva. "Hasta que el Divorcio nos Una" es "hasta que la muerte nos separe" con una sola palabra cambiada.

**Legibilidad de género en segundos.** El espectador no necesita el póster ni el tráiler. El título ya dice si es comedia o terror, y más o menos de qué va.

**Ironía como gancho.** Los mejores títulos tuercen lo familiar lo suficiente para crear fricción. "El Godín de los Cielos" eleva a la criatura más mundana al estatus de hombre poderoso. "Padre Nuestro que Estás en Cancún" reescribe el Padrenuestro con un chiste de padre ausente.

**Especificidad mexicana.** El godín, el cuñado, el Cancún, el grupo de WhatsApp — coordenadas culturales mexicanas, no latinoamericanas genéricas. Generan identidad e identificación.

**Boca a boca incorporado.** Cortos, pegajosos, citables. Se pueden decir en un audio de WhatsApp y la gente ya quiere verla.

**Títulos de referencia que funcionaron:**
- Hasta que la Boda nos Separe (81M pesos, sin estrellas)
- No Manches Frida (entró al vocabulario cotidiano)
- Salvando al Soldado Pérez
- Mirreyes vs Godínez
- No Se Aceptan Devoluciones (~600M pesos)
- Nosotros los Nobles (~340M pesos)

**Títulos del pipeline actual de Lemon que aplican este patrón:**
El Godín de los Cielos, No Eres Tú Son Mis Daddy Issues, Mi Bully es mi Cuñado, Padre Nuestro que Estás en Cancún, Hasta que el Divorcio nos Una, El Terapeuta de mi Pareja, Amiga Date Cuenta, El Grupo de WhatsApp, Reunión de Generación.

---

## Modos de operación

### MODO FRÍO — Sin material, solo brainstorm

El usuario quiere títulos que puedan inspirar historias. No hay premisa ni guion.

**Proceso:**
1. Generar 10 a 15 títulos en diferentes categorías de dicho/frase base: rezos y oraciones, votos y rituales sociales, relaciones familiares, slang laboral, tecnología cotidiana, frases de pareja, frases de amistad, eventos sociales mexicanos.
2. Priorizar títulos que abran múltiples posibilidades narrativas, no que cierren a una sola historia.
3. Output: título + una línea de qué dicho usa y qué ironía carga.

### MODO CON MATERIAL — Idea, premisa, tratamiento, o guion

El usuario trae algo concreto y quiere títulos para ese proyecto.

**Proceso:**
1. Leer el material e identificar: conflicto central, relaciones clave, coordenadas culturales, tono.
2. Buscar dichos, frases, rezos, o expresiones que colisionen con esas coordenadas.
3. Generar 8 a 12 títulos específicos para el proyecto.
4. Output: título + una línea explicando qué frase toma prestada y cómo la tuerce.

---

## Output

Formato fijo. Sin introducción, sin rankings numerados con puntuaciones, sin headers por categoría a menos que el usuario lo pida.

```
TÍTULO EN MAYÚSCULAS
Una línea: qué frase toma prestada y cómo la tuerce.

TÍTULO EN MAYÚSCULAS
Una línea: qué frase toma prestada y cómo la tuerce.
```

Cantidad: 10 a 15 títulos en modo frío, 8 a 12 en modo con material.

---

## Criterios de calidad — checklist interno

Antes de incluir un título, verificar:

- [ ] ¿Se basa en una frase que el público mexicano ya conoce?
- [ ] ¿El género (comedia) es legible sin póster ni tráiler?
- [ ] ¿Tiene una capa de ironía o torsión sobre la frase original?
- [ ] ¿Se puede decir en voz alta y la gente lo recuerda?
- [ ] ¿Viaja a otros mercados hispanohablantes (España, Argentina, Colombia)?
- [ ] ¿Tiene potencial de meme en TikTok e Instagram?

Si un título no pasa al menos 4 de 6, no incluirlo.

---

## Lo que NO hacer

- Títulos en inglés o mezcla inglés/español a menos que el user lo pida explícitamente.
- Títulos de una sola palabra genérica (La Boda, El Divorcio) sin giro.
- Títulos de autor o referencias literarias que excluyan públicos no universitarios.
- Títulos que requieran contexto para entenderse.
- Títulos que suenen a película española o argentina — si no hay coordenada mexicana, no cuenta.
- Explicaciones largas. El output es limpio y directo.

---

## Contexto de mercado

El título es la primera línea de marketing. Para comedias mexicanas de presupuesto medio, un buen título puede ser la diferencia entre una corrida rentable y un estreno que apenas cubre gastos, porque reduce el costo de educar al público sobre la premisa. La campaña amplifica, no explica.

En streaming, los títulos compiten por el clic contra contenido de España, Argentina, Colombia, y Estados Unidos. Un título construido sobre una frase reconocible tiene ventaja natural de descubrimiento para cualquier hispanohablante.
