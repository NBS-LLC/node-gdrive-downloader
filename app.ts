import fs from 'fs';
import { Credentials as AccessToken, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { performance } from 'perf_hooks';
import reader from 'readline-sync';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const HOME_DIR = require('os').homedir();
const CONFIG_DIR = `${HOME_DIR}/.node-gdrive-downloader`;
const TOKEN_PATH = `${CONFIG_DIR}/token.json`;

(async () => {
    const credentials = fs.readFileSync(`${CONFIG_DIR}/credentials.json`, { encoding: 'utf-8' });
    const auth = await authorize(JSON.parse(credentials));
    await downloadFiles(auth, '/mnt/raid1/private/selahrain');
    // TODO: Make downloads resumable
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
 * Download media files.
 * @param auth An authorized OAuth2 client.
 */
async function downloadFiles(auth: OAuth2Client, destination: string) {
    const drive = google.drive({ version: 'v3', auth });

    let pageToken: string | undefined = undefined;
    do {
        const response = await drive.files.list({
            q: "'1hPyRfnkuCAGOVvmPdVFI9UYp_98-rHLN' in parents", // TODO: Search for the parent folder id based on name
            pageSize: 1000,
            fields: 'nextPageToken, files(id, name, size)',
            pageToken: pageToken
        });

        pageToken = response.data.nextPageToken;
        const files = response.data.files;

        if (files && files.length) {
            const start = performance.now();

            let totalSizeBytes = 0;
            await Promise.all(files.map(async (file) => {
                totalSizeBytes += parseInt(file.size as string, 10);
                await downloadFile(auth, file.id as string, file.name as string, destination);
            }));

            const end = performance.now();
            const totalSizeKB = totalSizeBytes / 1000;
            const elapsedSec = (end - start) / 1000;
            const speed = totalSizeKB / elapsedSec;
            console.log('Download rate:', round(speed), 'KB per second');
        } else {
            console.log('No files found.');
        }
    } while (pageToken);
}

async function downloadFile(auth: OAuth2Client, fileId: string, filename: string, destination: string) {
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'arraybuffer' });

    const destFullPath = `${destination}/${filename}`;
    fs.writeFileSync(destFullPath, Buffer.from(response.data as ArrayBuffer), 'binary');
    console.log('Downloaded file to', destFullPath);
}

function round(value: number): number {
    const formattedValue = value.toLocaleString('en', {
        useGrouping: false,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return Number(formattedValue);
}