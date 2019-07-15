const config = require("../../../config");
const {createMessageAdapter} = require("@slack/interactive-messages");
const slackInteractions = createMessageAdapter(config.SIGNING_SECRET);
const {WebClient} = require("@slack/web-api");
const mail_object = require("../../mail_object");
const emailClient = require('./send_email');
const {sendEmail} = require("./send_email");
const Logger = require(`../../../universal_logger`);
const Ticket = require(`../../../database/models/ticket`);

slackInteractions.action({actionId: /dabat(\/\d)*/}, (payload, respond) => {
    Logger.info(payload.message.text);
    Logger.info(payload.actions[0].selected_option.value);
    const selected_option = payload.actions[0].selected_option.value;
    const actionId = payload.actions[0].action_id;
    const jsonPath = actionId.split("/").slice(1);
    var jsonObject = Object.assign({}, mail_object);
    jsonPath.forEach(keyIndex => {
        jsonObject = Object.assign({}, jsonObject[Object.keys(jsonObject)[keyIndex]]);
    });
    const subDepartment = Object.keys(jsonObject)[selected_option];
    const client = new WebClient(config.BOT_USER_TOKEN);
    respond({
        text: "You've chosen " + subDepartment
    });
    jsonObject = jsonObject[Object.keys(jsonObject)[selected_option]];


    if (jsonObject.hasOwnProperty("email") === false)
        client.chat.postMessage({
            as_user: true,
            channel: payload.user.id,
            text: `Subcategory : ${subDepartment}`,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Where do you need Assistance in ${subDepartment}?`
                    },
                    "accessory": {
                        "action_id": `${actionId}/${selected_option}`,
                        "type": "static_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Choose a Sub Department",
                            "emoji": true
                        },
                        "options":
                            Array.from(Array(Object.keys(jsonObject).length).keys()).map(index => {
                                return {
                                    "text": {
                                        "type": "plain_text",
                                        "text": Object.keys(jsonObject)[index]
                                    },
                                    "value": `${index}`
                                }
                            })
                    }
                }
            ]
        });
    else {

        console.log(payload.channel.id);

        const [departmentString, leaf] = jsonPath.concat([0, 0, 0]).reduce(([tdept, jsonObj], index) => {
            return [tdept + Object.keys(jsonObj)[index] + " -> ", jsonObj[Object.keys(jsonObj)[index]]];
        }, ["", mail_object]);

        Ticket.findAll({
            where:{
                channel: payload.channel.id
            }
        }).then(tickets => {
            tickets[0].setDataValue("state", "1");
            tickets[0].setDataValue("department", departmentString);
            tickets[0].save();
        }).catch(Logger.error);

        client.chat.postMessage({
            channel: payload.channel.id,
            text: "Darling, don't you worry. I know just who to contact about it. \n Meanwhile would you care to tell me what happened in short",
            as_user: true
        }).catch(Logger.error);
    }

});

slackInteractions.action("error", console.log);

module.exports = slackInteractions.expressMiddleware();