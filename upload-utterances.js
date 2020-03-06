"use strict";

const args = require("yargs").array("intents").argv;
const exec = require("child_process").execSync;
const region_id = "us-east-1";
const csv = require("csv-parser");
const fs = require("fs");

console.log("Spreadsheet: " + args.sheet);
console.log("Intent List: " + args.intents);

var aws_response1 = "";
var aws_response2 = "";

async function addUtterances() {
  args.intents.forEach(async intent => {

    // Read CSV File
    let utterances = await readCSV(args.sheet, intent);
    console.log("Missed Data: ");

    var getIntentCmd = `aws lex-models get-intent --region ${region_id} --name ${intent} --intent-version "\$LATEST" > intent.json`;
    try {
      aws_response1 = exec(getIntentCmd);

      // Read intent.json file
      fs.readFile("intent.json", function(err, data) {
        // Check for errors
        if (err) throw err;
        // Converting to JSON
        const intentJson = JSON.parse(data);
        delete intentJson["createdDate"];
        delete intentJson["lastUpdatedDate"];
        delete intentJson["version"];
        for (var utterance of utterances) {
          intentJson["sampleUtterances"].push(utterance);
        }

        // Writing to a file
        fs.writeFile("intent.json", JSON.stringify(intentJson), err => {
          // Checking for errors
          if (err) throw err;

          console.log("Done writing"); // Success
          var updateIntendCmd = `aws lex-models put-intent --region ${region_id} --name ${intent} --cli-input-json file://intent.json`;
          aws_response2 = exec(updateIntendCmd);
          console.log("AWS Response: ", aws_response2);
        });
      });
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
              //console.log(value);
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

addUtterances();
