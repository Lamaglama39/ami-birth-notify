const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const https = require('https');
const url = require('url');

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // SNSイベントをパース
    let imageBuilderEvent = event;
    if (event.Records && event.Records[0] && event.Records[0].Sns) {
        try {
            imageBuilderEvent = JSON.parse(event.Records[0].Sns.Message);
        } catch (error) {
            console.error('Error parsing SNS message:', error);
        }
    }
    
    // パラメータストアからSlackのWebhook URLとチャンネルを取得
    const ssmClient = new SSMClient();
    const webhookUrlParam = await ssmClient.send(
        new GetParameterCommand({
            Name: process.env.SLACK_WEBHOOK_PARAM_NAME,
            WithDecryption: true
        })
    );
    const slackChannelParam = await ssmClient.send(
        new GetParameterCommand({
            Name: process.env.SLACK_CHANNEL_PARAM_NAME,
            WithDecryption: true
        })
    );

    const webhookUrl = webhookUrlParam.Parameter.Value;
    const slackChannel = slackChannelParam.Parameter.Value;

    // イベントからイメージの詳細を抽出
    const imageArn = imageBuilderEvent.arn || 'N/A';
    const imageState = imageBuilderEvent.state?.status || 'N/A';
    const imageId = imageBuilderEvent.outputResources?.amis?.[0]?.image || 'N/A';
    const imageName = imageBuilderEvent.name || 'N/A';
    const recipeVersion = imageBuilderEvent.version || 'N/A';
    const buildVersion = imageBuilderEvent.buildVersion || 'N/A';
    const osVersion = imageBuilderEvent.osVersion || 'N/A';
    const region = imageBuilderEvent.outputResources?.amis?.[0]?.region || 'N/A';
    const recipeName = imageBuilderEvent.imageRecipe?.name || 'N/A';
    const parentImage = imageBuilderEvent.imageRecipe?.parentImage || 'N/A';
    
    // Slackメッセージを作成
    const message = {
        channel: slackChannel,
        username: 'AWS Image Builder',
        icon_emoji: ':aws:',
        attachments: [{
            color: '#36a64f',
            title: '👶 New AMI is Born 👶',
            fields: [
                {
                    title: 'Image Name',
                    value: imageName,
                    short: true
                },
                {
                    title: 'Image Version',
                    value: `${recipeVersion}/${buildVersion}`,
                    short: true
                },
                {
                    title: 'AMI ID',
                    value: imageId,
                    short: true
                },
                {
                    title: 'Status',
                    value: imageState,
                    short: true
                },
                {
                    title: 'OS Version',
                    value: osVersion,
                    short: true
                },
                {
                    title: 'Region',
                    value: region,
                    short: true
                },
                {
                    title: 'Recipe',
                    value: recipeName,
                    short: true
                },
                {
                    title: 'Parent Image',
                    value: parentImage,
                    short: true
                }
            ],
            footer: 'AWS Image Builder',
            ts: Math.floor(Date.now() / 1000)
        }]
    };
    
    // Slackにメッセージを送信
    try {
        await sendSlackMessage(webhookUrl, message);
        return { statusCode: 200, body: 'Notification sent to Slack' };
    } catch (error) {
        console.error('Error sending Slack message:', error);
        throw error;
    }
};

function sendSlackMessage(webhookUrl, message) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(webhookUrl);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`Status Code: ${res.statusCode} ${responseBody}`));
                } else {
                    resolve(responseBody);
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(JSON.stringify(message));
        req.end();
    });
}
