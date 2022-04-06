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
    const auth = await authorize(JSON.parse(credentials));
    await listFiles(auth);
})();

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param credentials The authorization client credentials.
 */
async function authorize(credentials): Promise<OAuth2Client> {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    let token: AccessToken;
    try {
        token = JSON.parse(fs.readFileSync(TOKEN_PATH, { encoding: 'utf-8' }));
    } catch (error) {
        token = await getAccessToken(oAuth2Client);
    }

    oAuth2Client.setCredentials(token);
    return oAuth2Client;
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param auth The OAuth2 client to get token for.
 */
async function getAccessToken(auth: OAuth2Client): Promise<AccessToken> {
    const authUrl = auth.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);
    const code = reader.question('Enter the code from that page here: ');

    try {
        const { tokens } = await auth.getToken(code);
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
 * @param auth An authorized OAuth2 client.
 */
async function listFiles(auth: OAuth2Client) {
    const drive = google.drive({ version: 'v3', auth });

    let pageToken: string | undefined = undefined;
    do {
        const response = await drive.files.list({
            q: "'1hPyRfnkuCAGOVvmPdVFI9UYp_98-rHLN' in parents",
            pageSize: 1000,
            fields: 'nextPageToken, files(id, name)',
            pageToken: pageToken
        });

        pageToken = response.data.nextPageToken;
        const files = response.data.files;

        if (files && files.length) {
            console.log('Files:');
            files.map((file) => {
                console.log(`${file.name} (${file.id})`);
            });
        } else {
            console.log('No files found.');
        }
    } while (pageToken);
}
