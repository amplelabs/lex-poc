#!/usr/bin/env node

"use strict";

const args = require("yargs").array("intents").argv;
const exec = require("child_process").execSync;
const csv = require("csv-parser");
const fs = require("fs");
require("dotenv").config();

const region_id = process.env.REGION_ID;

console.log("Spreadsheet: " + args.sheet);
console.log("Intent List: " + args.intents);

async function addUtterances() {
  args.intents.forEach(async intent => {
    //Get latest intent version from bot
    const getBotCmd = `aws lex-models get-bot --region ${region_id} --name ${args.bot} --version-or-alias $LATEST > bot.json`;
    const getBotResponse = exec(getBotCmd);
    // Read bot json file
    const botData = fs.readFileSync("bot.json");
    // Converting to JSON
    const botJson = JSON.parse(botData);
    const latestIntentVersion = botJson["intents"].find(
      a => a["intentName"] == intent
    );

    console.log(
      `Latest intent version for ${intent} is ${latestIntentVersion["intentVersion"]}`
    );

    // Read CSV File
    let utterances = await readCSV(args.sheet, intent);
    const getIntentCmd = `aws lex-models get-intent --region ${region_id} --name ${intent} --intent-version ${latestIntentVersion["intentVersion"]} > intent.json`;
    const getLatestIntentCmd = `aws lex-models get-intent --region ${region_id} --name ${intent} --intent-version $LATEST > latestIntent.json`;
    try {
      exec(getLatestIntentCmd);
      exec(getIntentCmd);
      // Read intent.json file
      const intentData = fs.readFileSync("intent.json");
      const latestIntentData = fs.readFileSync("latestIntent.json");
      // Converting to JSON
      const intentJson = JSON.parse(intentData);
      const latestIntentJson = JSON.parse(latestIntentData);
      delete intentJson["createdDate"];
      delete intentJson["lastUpdatedDate"];
      delete intentJson["version"];
      // update Checksum
      intentJson["checksum"] = latestIntentJson["checksum"];
      for (var utterance of utterances) {
        intentJson["sampleUtterances"].push(utterance);
      }
      // Check and remove duplicates
      intentJson["sampleUtterances"] = removeDuplicates(
        intentJson["sampleUtterances"]
      );
      // Writing to intent.json file
      fs.writeFileSync("intent.json", JSON.stringify(intentJson));
      console.log("Done writing to intent.json"); // Success
      // Update the intent with the new utterances
      const updateIntendCmd = `aws lex-models put-intent --region ${region_id} --name ${intent} --cli-input-json file://intent.json`;
      const aws_response2 = exec(updateIntendCmd);
      console.log(
        `AWS Update Intent Response for ${intent} Intent: `,
        aws_response2.toString()
      );

      // if (args.buildBot) {
      //   console.log(`Rebuilding ${args.bot} Bot...`);
      //   console.log("Reading bot.json file");
      //   delete botJson["createdDate"];
      //   delete botJson["lastUpdatedDate"];
      //   delete botJson["status"];
      //   delete botJson["version"];
      //   botJson["processBehavior"] = "BUILD";
      //   // Writing updates to bot.json file
      //   fs.writeFileSync("bot.json", JSON.stringify(botJson));
      //   console.log("Done writing to bot.json"); // Success
      //   const rebuildBotCmd = `aws lex-models put-bot --region ${region_id} --name ${args.bot} --cli-input-json file://bot.json`;
      //   const rebuildBotResponse = exec(rebuildBotCmd);
      //   console.log("Rebuild Bot Response: ", rebuildBotResponse);
      // }

      // Publish the intent
      // Get checksum of the latest intent revision
      console.log("\n\nPublishing new version of the intent...")
      const getLatestIntentCmd2 = `aws lex-models get-intent --region ${region_id} --name ${intent} --intent-version $LATEST > latestIntent2.json`;
      exec(getLatestIntentCmd2);
      const latestIntentData2 = fs.readFileSync("latestIntent2.json");
      const latestIntentJson2 = JSON.parse(latestIntentData2);
      delete latestIntentJson2["createdDate"];
      delete latestIntentJson2["lastUpdatedDate"];
      delete latestIntentJson2["version"];

      // Need to first publish all slots of the intent and save each slot's version number
      for (var slot of latestIntentJson2.slots){
        // Ignore Amazon built-in slot types
        if (slot.slotTypeVersion) {
          var getSlotCmd = `aws lex-models get-slot-type --region ${region_id} --name ${slot.slotType} --slot-type-version $LATEST`;
          var getSlotResponse = exec(getSlotCmd);
          var slotChecksum = JSON.parse(getSlotResponse.toString()).checksum;
          var publishSlotCmd = `aws lex-models create-slot-type-version --region ${region_id} --name ${slot.slotType} --checksum ${slotChecksum}`
          var pubishSlotResponse = exec(publishSlotCmd);
          var versionNo = JSON.parse(pubishSlotResponse.toString()).version;
          console.log(`For slot type: ${slot.slotType}, the new version number is: ${versionNo}`);
          // Update this version number in the intent json 
          slot.slotTypeVersion = versionNo;
        }
      }

      // Save the revision to the intent
      // Writing to intent.json file
      fs.writeFileSync("latestIntent2.json", JSON.stringify(latestIntentJson2));
      const reviseIntentCmd = `aws lex-models put-intent --name ${intent} --cli-input-json file://latestIntent2.json`;
      exec(reviseIntentCmd);

      // Get the checksum of the latest revised intent
      const getRevisedIntent = `aws lex-models get-intent --region ${region_id} --name ${intent} --intent-version $LATEST > revisedIntent.json`;
      exec(getRevisedIntent);
      const revisedIntentData = fs.readFileSync("revisedIntent.json");
      const revisedIntentJson = JSON.parse(revisedIntentData);
      const latestChecksum = revisedIntentJson["checksum"];

      // Publish the new version of the intent
      const publishIntentCmd = `aws lex-models create-intent-version --region ${region_id} --name ${intent} --checksum ${latestChecksum}`;
      const pubIntentResponse = exec(publishIntentCmd, );
      console.log("New Intent Version Response: ", pubIntentResponse.toString());
      const publishIntentVersion = JSON.parse(pubIntentResponse.toString()).version;
      console.log("New Published Version of Intent: ", publishIntentVersion);

      // Publish the bot
      console.log(`\n\nPublishing ${args.bot} Bot for intent ${intent}...`);
      const getBotCmd2 = `aws lex-models get-bot --region ${region_id} --name ${args.bot} --version-or-alias $LATEST > bot2.json`;
      exec(getBotCmd2);
      // Read bot json file
      const botData2 = fs.readFileSync("bot2.json");
      // Converting to JSON
      const botJson2 = JSON.parse(botData2);
      delete botJson2["createdDate"];
      delete botJson2["lastUpdatedDate"];
      delete botJson2["status"];
      delete botJson2["version"];

      botJson2["intents"].find(
        a => a["intentName"] == intent
      ).intentVersion = publishIntentVersion;
      
      // Writing updates to bot.json file
      fs.writeFileSync("bot2.json", JSON.stringify(botJson2));
      console.log("Done writing to bot.json"); // Success
      const newRevisionBotCmd = `aws lex-models put-bot --name ${args.bot} --cli-input-json file://bot2.json`;
      const revisionResponse = exec(newRevisionBotCmd);
      const botVersion = JSON.parse(revisionResponse.toString()).version;

      // Get checksum of the latest bot version
      const getBotCmd3 = `aws lex-models get-bot --region ${region_id} --name ${args.bot} --version-or-alias ${botVersion} > bot3.json`;
      exec(getBotCmd3);
      // Read bot json file
      const botData3= fs.readFileSync("bot3.json");
      // Converting to JSON
      const botJson3 = JSON.parse(botData3);
      const checksumValue = botJson3.checksum;
      
      // Publish a new version of the bot
      const publishBotCmd = `aws lex-models create-bot-version --region ${region_id} --name ${args.bot} --checksum ${checksumValue}`;
      const publishBotResponse = exec(publishBotCmd);
      console.log("Publish Bot Response: ", publishBotResponse.toString());
    
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
