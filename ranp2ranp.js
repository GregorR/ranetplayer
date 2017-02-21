#!/usr/bin/env node

const fs = require("fs");
const ranp = require("./ranp.js");

var inputFile = null;
var outputFile = null;

// Delay every reset
var delayPerReset = 0;
var delay = 0;
var atLeast = 0;

// Wait for first reset
var waitForReset = false;

// Handle arguments
for (var ai = 2; ai < process.argv.length; ai++) {
   var arg = process.argv[ai];
   switch (arg) {
      case "-d":
      case "--delay":
         delayPerReset = +process.argv[++ai];
         break;

      case "-r":
      case "--reset-wait":
         waitForReset = true;
         break;

      case "-h":
      case "--help":
         console.log(
            "Use: ranp2ranp.js [options] <from file> <to file>\n" +
            "Options:\n" +
            "    -d <reset delay>\n" +
            "            : Delay input after every reset. Delay may be\n" +
            "              negative.\n" +
            "    -r      : Ignore input up to the first reset or savestate\n" +
            "              load.\n");
         process.exit(0);

      default:
         if (arg[0] === "-") {
            console.error("Unrecognized argument " + arg);
            process.exit(1);
         }
         if (!inputFile)
            inputFile = fs.readFileSync(arg);
         else if (!outputFile)
            outputFile = fs.createWriteStream(arg);
         else {
            console.error("Unrecognized argument " + arg);
            process.exit(1);
         }
   }
}

if (!inputFile || !outputFile) {
   console.error("Missing required arguments.");
   process.exit(1);
}

// Handle commands
var cmd = {"next": 0};
while (cmd = ranp.parse(inputFile, cmd.next)) {
   // Apply the delay if applicable
   if (delay) {
      if (cmd.cmd === ranp.commands.INPUT ||
          cmd.cmd === ranp.commands.NOINPUT ||
          cmd.cmd === ranp.commands.MODE ||
          cmd.cmd === ranp.commands.CRC ||
          cmd.cmd === ranp.commands.LOAD_SAVESTATE ||
          cmd.cmd === ranp.commands.RESET ||
          cmd.cmd === ranp.commands.FLIP_PLAYERS) {
         cmd.payload[0] += delay;
         if (cmd.payload[0] < atLeast)
            continue;
      }
   }

   // Wait for reset if applicable
   if (waitForReset) {
      if (cmd.cmd === ranp.commands.RESET)
         waitForReset = false;
      else
         continue;
   }

   // Write out the command
   outputFile.write(ranp.gen(cmd.cmd, cmd.payload));

   // Change the delay if applicable
   if (delayPerReset) {
      if (cmd.cmd === ranp.commands.RESET) {
         for (var di = 0; di < delayPerReset; di++)
            outputFile.write(ranp.gen(ranp.commands.INPUT,
               [cmd.payload[0] + di, 0, 0, 0, 0]));
         delay += delayPerReset;
         atLeast = cmd.payload[0];
      }
   }
}

outputFile.end();
