#!/usr/bin/env node
// Arranca "next dev" forzando el directorio de trabajo del proceso a la
// carpeta de la app, en vez de heredar el cwd de quien lo lanza (que a veces
// es la carpeta de OneDrive, la cual falla intermitentemente incluso al
// hacer un simple getcwd() — ver PROJECT_BRIEF.md). Sin esto, código como
// process.cwd() dentro de rutas de la API resuelve a un sitio equivocado.
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.argv = [process.argv[0], "next", "dev", "--webpack", "-p", "3000"];

require("next/dist/bin/next");
