import fs from 'fs';
import { Credentials as AccessToken, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import reader from 'readline-sync';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const HOME_DIR = require('os').homedir();
const CONFIG_DIR = `${HOME_DIR}/.node-gdrive-downloader`;
const TOKEN_PATH = `${CONFIG_DIR}/token.json`;

(async () => {
    const credentials = fs.readFileSync(`${CONFIG_DIR}/credentials.json`, { encoding: 'utf-8' });
    await authorize(JSON.parse(credentials), listFiles);
})();

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param credentials The authorization client credentials.
 * @param callback The callback to call with the authorized client.
 */
async function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    let token: AccessToken;
    try {
        token = JSON.parse(fs.readFileSync(TOKEN_PATH, { encoding: 'utf-8' }));
    } catch (error) {
        token = await getAccessToken(oAuth2Client);
    }

    oAuth2Client.setCredentials(token);
    callback(oAuth2Client);
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param oAuth2Client The OAuth2 client to get token for.
 */
async function getAccessToken(oAuth2Client: OAuth2Client): Promise<AccessToken> {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);
    const code = reader.question('Enter the code from that page here: ');

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        try {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens), { encoding: 'utf-8' });
            console.log('Token stored to', TOKEN_PATH);
        } catch (error) {
            console.error(error);
        }

        return tokens;
    } catch (error) {
        console.error('Error retrieving the access token.');
        throw error;
    }
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
    const drive = google.drive({ version: 'v3', auth });
    drive.files.list({
        // q: "'1hPyRfnkuCAGOVvmPdVFI9UYp_98-rHLN' in parents",
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res?.data.files;
        if (files && files.length) {
            console.log('Files:');
            files.map((file) => {
                console.log(`${file.name} (${file.id})`);
            });
        } else {
            console.log('No files found.');
        }
    });
}
