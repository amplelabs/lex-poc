## To run build script:
./upload-utterances.js --sheet "excel-sheet-name"  --bot "bot-name" --intents "list of intents separated by a space" --buildBot "true or false"

### Flag Descriptions:
Required:
<ul>
<li>sheet: The name of csv sheet to pull utterances from.</li>
<li>bot: The name of the bot that hosts intents where utterances are to be uploaded.</li>
<li>intents: The names(s) of the intents from which utterances are to be uploaded. Specify the list of utterances by listing them consecutively separated by spaces.</li>
</ul>
Optional:
<ul>
<li>buildBot: Flag to build or not build bot. Set to true if bot to be build. Omit if bot is not to be built.</li>
</ul>

### Example uses:
<ol>
<li>./upload-utterances.js --sheet "New Utterances.csv" --bot ScheduleAppointment --intents Greetings </li>
<li>./upload-utterances.js --sheet "New Utterances.csv" --bot ScheduleAppointment --intents Greetings Appreciation --buildBot true </li>
</ol>

