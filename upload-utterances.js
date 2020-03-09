#!/usr/bin/env node

"use strict";

const args = require("yargs").array("intents").argv;
const exec = require("child_process").execSync;
const csv = require("csv-parser");
const fs = require("fs");
const region_id = "us-east-1";

console.log("Spreadsheet: " + args.sheet);
console.log("Intent List: " + args.intents);

async function addUtterances() {
  args.intents.forEach(async intent => {
    //Get latest intent version from bot
    var getBotCmd = `aws lex-models get-bot --region ${region_id} --name ${args.bot} --version-or-alias $LATEST > bot.json`;
    const getBotResponse = exec(getBotCmd);
    // Read bot json file
    var botData = fs.readFileSync("bot.json");
    // Converting to JSON
    const botJson = JSON.parse(botData);
    const latestIntentVersion = botJson["intents"].find(a => a["intentName"] == intent);

    console.log(`Latest intent version for ${intent} is ${latestIntentVersion["intentVersion"]}`);

    // Read CSV File
    let utterances = await readCSV(args.sheet, intent);
    var getIntentCmd = `aws lex-models get-intent --region ${region_id} --name ${intent} --intent-version ${latestIntentVersion["intentVersion"]} > intent.json`;
    try {
      const aws_response1 = exec(getIntentCmd);
      // Read intent.json file
      var data = fs.readFileSync("intent.json");
      // Converting to JSON
      const intentJson = JSON.parse(data);
      delete intentJson["createdDate"];
      delete intentJson["lastUpdatedDate"];
      delete intentJson["version"];
      for (var utterance of utterances) {
        intentJson["sampleUtterances"].push(utterance);
      }
      //Check and remove duplicates
      intentJson["sampleUtterances"] = removeDuplicates(
        intentJson["sampleUtterances"]
      );
      // Writing to intent.json file
      fs.writeFileSync("intent.json", JSON.stringify(intentJson));
      console.log("Done writing to intent.json"); // Success
      var updateIntendCmd = `aws lex-models put-intent --region ${region_id} --name ${intent} --cli-input-json file://intent.json`;
      const aws_response2 = exec(updateIntendCmd);
      console.log(`AWS Update Intent Response for ${intent}: `, aws_response2);
      if (args.buildBot) {
        console.log(`Rebuilding ${args.bot} Bot...`);
        console.log("Reading bot.json file");
        delete botJson["createdDate"];
        delete botJson["lastUpdatedDate"];
        delete botJson["status"];
        delete botJson["version"];
        botJson["processBehavior"] = "BUILD";
        // Writing updates to bot.json file
        fs.writeFileSync("bot.json", JSON.stringify(botJson));
        console.log("Done writing to bot.json"); // Success
        var rebuildBotCmd = `aws lex-models put-bot --region ${region_id} --name ${args.bot} --cli-input-json file://bot.json`;
        const rebuildBotResponse = exec(rebuildBotCmd);
        console.log("Rebuild Bot Response: ", rebuildBotResponse);
      }
    } catch (error) {
      console.error(error);
      return;
    }
  });
}

async function readCSV(sheet, intent) {
  let result = [];
  return new Promise((resolve, reject) => {
    try {
      fs.createReadStream(sheet)
        .pipe(csv())
        .on("data", row => {
          //console.log(row);
          result.push(row);
        })
        .on("end", () => {
          let intentVals = [];
          for (var eachObj of result) {
            if (eachObj.hasOwnProperty(intent) && eachObj[intent] != "") {
              var value = eachObj[intent];
              intentVals.push(value);
            }
          }
          resolve(intentVals);
          console.log("CSV file successfully processed");
        });
    } catch (err) {
      reject(err);
    }
  });
}

function removeDuplicates(array) {
  let a = [];
  array.map(x => {
    if (!a.includes(x)) {
      a.push(x);
    }
  });
  return a;
}

addUtterances();
