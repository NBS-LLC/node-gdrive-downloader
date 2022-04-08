import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { authorize } from './auth';

const trialRun = true;

(async () => {
    const auth = await authorize();
    const mediaFiles = await fetchMediaFiles(auth);

    console.log();
    console.log(`Discovered ${mediaFiles.length} media files.`);
})();

interface MediaFile {
    id: string,
    name: string,
    size: string
}

/**
 * Retrieve  list of media files.
 * @param auth An authorized OAuth2 client.
 */
async function fetchMediaFiles(auth: OAuth2Client): Promise<MediaFile[]> {
    const drive = google.drive({ version: 'v3', auth });

    let fileList: MediaFile[] = [];
    let pageToken: string | undefined = undefined;
    do {
        const response = await drive.files.list({
            q: "'1hPyRfnkuCAGOVvmPdVFI9UYp_98-rHLN' in parents", // TODO: Search for the parent folder id based on name
            orderBy: 'name_natural',
            pageSize: trialRun ? 10 : 1000,
            fields: 'nextPageToken, files(id, name, size)',
            pageToken: pageToken
        });

        pageToken = trialRun ? undefined : response.data.nextPageToken;
        const files: MediaFile[] = response.data.files;

        if (files) {
            fileList = fileList.concat(files);
            files.map((file) => {
                console.debug(`${file.name} | ${file.id} | ${file.size}`);
            });
        }
    } while (pageToken);
    return fileList;
}
