var express = require('express');
var router = express.Router();
const mail_object = require("../../mail_object");
const config = require("../../../config");
const {WebClient} = require("@slack/web-api");
const Logger = require("../../../universal_logger");

router.post("/dab", function (req, res, next) {
    Logger.info(req.body);
    const grievance = req.body.text;
    const client = new WebClient(config.BOT_USER_TOKEN);
    client.chat.postMessage({
        channel: req.body.user_id,
        user: req.body.user_id,
        as_user: true,
        text: `${grievance} \n Houston, We have a problem!`,
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Where do you need Assistance?"
                },
                "accessory": {
                    "action_id":"dabat",
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Choose a Department",
                        "emoji": true
                    },
                    "options":
                            Array.from(Array(Object.keys(mail_object).length).keys()).map(index => {
                                return {
                                    "text":{
                                        "type": "plain_text",
                                        "text": Object.keys(mail_object)[index]
                                    },
                                    "value": `${index}`
                                }
                            })
                }
            }
        ]
    }).catch(Logger.info);


    res.status(200).send("Request Received");

});

module.exports = router;
