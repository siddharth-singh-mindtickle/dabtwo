const {createEventAdapter} = require('@slack/events-api');
const config = require('../../../config');
const slackEvents = createEventAdapter(config.SIGNING_SECRET);
const Logger = require(`../../../universal_logger`);
const Channel = require(`../../../database/models/channel`);
const {WebClient} = require("@slack/web-api");
const Ticket = require(`../../../database/models/ticket`);
const moment = require(`moment`);
const Sequelize = require(`sequelize`);
const mail_object = require(`../../mail_object`);
const CronJob = require(`cron`).CronJob;
const {Wit, log} = require(`node-wit`);

global.dabChannels = new Set(); // Local Cache
global.notDabChannels = new Set(); // Local Cache


var staleTicketCleaner = new CronJob(`*/2 * * * *`, function () {
    Logger.info(`Cleaning Stale Tickets`);
    // Delete Stale Tickets
    Ticket.destroy({
        where: {
            updatedAt: {
                [Sequelize.Op.lt]: moment().subtract(3, "minutes").toDate()
            },
        },

        individualHooks: true
    }).catch(Logger.error);
}, null, true, `Asia/Kolkata`);

staleTicketCleaner.start();


async function rebuildCache() {
    Logger.info(`Rebuilding Cache ` + Date());

    await Channel.findAll({}).then(channels =>
        channels.map(e => e.getDataValue("channel")
        ).forEach(e => {
            dabChannels.add(e);
        })
    );
    //dabChannels.forEach(e => console.log(e));
    Logger.info(`Cache Rebuilt ` + Date());
}

rebuildCache().catch(Logger.error);

const FSA = {
    "0": sendHi,
    "1": getDepartment,
    "2": getSubject,
    "3": getDescription,
    "4": getPictures
};


// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im

function extractBotId() {
    const client = new WebClient(config.BOT_USER_TOKEN);
    return client.users.list().then(users => {
        return users.members.filter(user => user.name === 'dab_20')[0].id
    }).catch((err) => {
        Logger.info(err);
        return null;
    })
}


slackEvents.on('message', (event) => {

    if (notDabChannels.has(event.channel) || (event.hasOwnProperty("subtype") === true && event.subtype === "message_changed"))
        return;

    extractBotId().then(dabId => {

        if (event.user === dabId)
            return;

        if (dabChannels.has(event.channel)) {
            Logger.info(`Message was sent to DAB at User Channel ${event.channel}`);
            handleDABRequests(event).catch(Logger.error);
        } else fallbackIncludeChannel(event, dabId).catch(Logger.error);
    }).catch(Logger.error);


});

async function fallbackIncludeChannel(event, dabId) {

    Logger.info("FETCHING CHANNELS ");

    const client = new WebClient(config.BOT_USER_TOKEN);
    client.conversations.members({
        channel: event.channel
    }).then(res => {
        return res.members;
    }).then(channelMembers => {
        if (channelMembers.length === 2 && channelMembers.includes(dabId)) {
            Channel.create({
                channel: event.channel
            }).catch(Logger.error);

            dabChannels.add(event.channel);
            handleDABRequests(event).catch(Logger.error);
        } else notDabChannels.add(event.channel);

    }).catch(Logger.error);

}

slackEvents.on('im_open', (event) => {
    //console.log(event);
    /*extractBotId().then(dabID => {
        if (dabID === event.user) {
            Logger.info("Dab was initiated for the first time, Store value in Database");
            Channel.create({
                channel: event.channel
            }).catch(Logger.error);
        }
    })*/
    dabChannels.add(event.channel);
});

slackEvents.on('im_close', (event) => {
    /** You don't actually need to do this**/
    extractBotId().then(dabId => {
        if (dabId === event.user) {
            Logger.info(`Dab was closed, Deleting value from store`);
            Channel.destroy({
                where: {
                    channel: event.channel
                }
            }).catch(Logger.error)
        }
    })
});


async function handleDABRequests(event) {


    Ticket.findAll({
        where: {
            channel: event.channel
        }
    }).then(
        tickets => {
            Logger.info(JSON.stringify(tickets));
            if (tickets.length === 0)
                return Ticket.create({
                    channel: event.channel
                });
            else return tickets[0];
        }
    ).then(ticket => {

        if (/forget/i.test(event.text) || /bhul/i.test(event.text) || /start over/i.test(event.text)) {
            ticket.setDataValue("state", parseInt(ticket.getDataValue("state")) + Object.keys(FSA).length);
            ticket.save();
            const client = new WebClient(config.BOT_USER_TOKEN);
            client.chat.postMessage({
                as_user: true,
                channel: ticket.getDataValue("channel"),
                text: "Babe, Was this supposed to be a legitimate answer to my question? \n Be clear Na, say Yes, or No"
            }).catch(Logger.error);
        } else if (ticket.getDataValue("state") >= Object.keys(FSA).length) {
            handleForget(event, ticket).catch(Logger.error);
        } else FSA[ticket.getDataValue("state")](event, ticket);
    });
}


async function handleForget(event, ticket) {
    const client = new WebClient(config.BOT_USER_TOKEN);

    if (/No/i.test(event.text) || /start over/i.test(event.text) || /restart/i.test(event.text)) {
        ticket.setDataValue("state", Object.keys(FSA).length);
        ticket.destroy();
        client.chat.postMessage({
            as_user: true,
            channel: ticket.getDataValue("channel"),
            text: "Okay Babe, Mein toh bhul gayi ! Theek We will do what you say ^_^ "
        }).catch(Logger.error);
    } else if (/yes/i.test(event.text) || /Yep/i.test(event.text) || /Haan/i.test(event.text)) {
        ticket.setDataValue("state", parseInt(ticket.getDataValue("state")) - Object.keys(FSA).length);
        ticket.save();
        client.chat.postMessage({
            as_user: true,
            channel: ticket.getDataValue("channel"),
            text: "Okay, We'll do this again, I will take that as a legitimate answer ONLY IF stop mentioning forget, start over or bhul. I get confused"
        }).catch(Logger.error);
    } else {
        ticket.setDataValue("state", Object.keys(FSA).length);
        ticket.destroy();
        client.chat.postMessage({
            as_user: true,
            channel: ticket.getDataValue("channel"),
            text: "Okay Babe, I didn't quite get what you meant but I am going to forget we even talked about this. If you don't wanna start over, stop mentioning forget, start over or bhul ja."
        }).catch(Logger.error);
    }
}

async function getSubject(event, ticket) {
    ticket.setDataValue("subject", event.text);
    ticket.setDataValue("state", "3");
    ticket.save();
    const client = new WebClient(config.BOT_USER_TOKEN);
    client.chat.postMessage({
        channel: event.channel,
        text: "Please tell me more na",
        as_user: true
    }).catch(Logger.error);


}

async function getDescription(event, ticket) {
    ticket.setDataValue("details", event.text);
    ticket.setDataValue("state", "4");
    ticket.save();

    const client = new WebClient(config.BOT_USER_TOKEN);
    client.chat.postMessage({
        channel: event.channel,
        text: "Baby, I am so sorry you weren't assisted earlier. I swear to god it won't happen again. Let me fix it for you, Can you send me some pics babe. \nYou can just say no if you don't want to :white_frowning_face: ",
        as_user: true
    }).catch(Logger.error);
}


async function getPictures(event, ticket) {
    //console.log(event);
    const file_string = (event.hasOwnProperty("files")) ? event.files.map(file => file.permalink).reduce((acc, val) => acc + "  " + val, "Screenshots: ") : "";
    Logger.info(file_string);


    const client = new WebClient(config.BOT_USER_TOKEN);

    client.chat.postMessage({
        channel: event.channel,
        text: "Babe, I have sent for someone who will take care of the issue for you :kissing_heart: Then you will be hap hap again like :heart: :heart:",
        as_user: true
    });

    ticket.setDataValue("state", "5");
    ticket.save();
    ticket.destroy();


}

async function sendHi(event, ticket) {
    const client = new WebClient(config.BOT_USER_TOKEN);

    await client.chat.postMessage({
        channel: ticket.getDataValue("channel"),
        text: "Hey there, Hon! You look worried. \n Tell me which Region and Department can help you and maybe I'll hook you up with someone",
        as_user: true
    }).catch(Logger.error);

    ticket.setDataValue("state", "1");
    ticket.save();
    /*
    client.chat.postMessage({
        channel: ticket.getDataValue("channel"),
        text: "Please select a Department",
        as_user: true,
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Where's the problem at?"
                },
                "accessory": {
                    "action_id": "dabat",
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Choose a Department",
                        "emoji": true
                    },
                    "options":
                        Array.from(Array(Object.keys(mail_object).length).keys()).map(index => {
                            return {
                                "text": {
                                    "type": "plain_text",
                                    "text": Object.keys(mail_object)[index]
                                },
                                "value": `${index}`
                            }
                        })
                }
            }
        ]
    }).catch(Logger.error);
     */
}

async function getDepartment(event, ticket) {
    const client = new Wit({
        accessToken: `6YLKT5GI6TGDUVTMMKZGEFZ555KP4EJB`
    });

    client.message(event.text, {}).then(data => {
        console.log(data.entities)

    });
}

// Handle errors (see `errorCodes` export)
slackEvents.on('error', Logger.error);

module.exports = slackEvents.expressMiddleware();