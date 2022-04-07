import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { authorize } from './auth';

const trialRun = false;

(async () => {
    const auth = await authorize();
    await listFiles(auth);
})();

/**
 * List media files.
 * @param auth An authorized OAuth2 client.
 */
async function listFiles(auth: OAuth2Client) {
    const drive = google.drive({ version: 'v3', auth });

    let pageToken: string | undefined = undefined;
    do {
        const response = await drive.files.list({
            q: "'1hPyRfnkuCAGOVvmPdVFI9UYp_98-rHLN' in parents", // TODO: Search for the parent folder id based on name
            pageSize: trialRun ? 10 : 1000,
            fields: 'nextPageToken, files(id, name)',
            pageToken: pageToken
        });

        pageToken = trialRun ? undefined : response.data.nextPageToken;
        const files = response.data.files;

        if (files && files.length) {
            files.map((file) => {
                console.log(`${file.name} (${file.id})`);
            });
        } else {
            console.log('No files found.');
        }
    } while (pageToken);
}
