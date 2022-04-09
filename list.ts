import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { authorize } from './auth';

const TRIAL_RUN = true;
const OUTPUT_PATH = './out';
const MODEL_NAME = 'judith';

(async () => {
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });

    const auth = await authorize();
    const fileFolder = await fetchFolderByName(auth, MODEL_NAME);
    const mediaFiles = await fetchMediaFiles(auth, fileFolder);

    console.log();
    console.log(`Discovered ${mediaFiles.length} media files`);

    const outputFilename = `${path.resolve(OUTPUT_PATH)}/${MODEL_NAME}_files.json`;
    fs.writeFileSync(outputFilename, JSON.stringify(mediaFiles, null, '  '), { encoding: 'utf-8' });

    console.log('Media files list written to', outputFilename);
})();

interface FolderFile {
    id: string;
    name: string;
}

interface MediaFile {
    id: string;
    name: string;
    size: string;
    mimeType: string;
}

/**
 * Retrieve a folder by its name.
 * @param auth An authorized OAuth2 client.
 * @param folderName The folder's name.
 * @returns A promise that resolves to a folder file object.
 */
async function fetchFolderByName(auth: OAuth2Client, folderName: string): Promise<FolderFile> {
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}'`,
        pageSize: 1,
        fields: 'files(id, name)',
    });

    if (response.data.files?.length) {
        return response.data.files[0] as FolderFile;
    } else {
        throw new Error(`A folder with the name "${folderName}" was not found.`);
    }
}

/**
 * Recursively retrieve a list of media files.
 * @param auth An authorized OAuth2 client.
 * @param folder The folder to start from.
 * @returns A promise that resolves to a list of media file objects.
 */
async function fetchMediaFiles(auth: OAuth2Client, folder: FolderFile): Promise<MediaFile[]> {
    const drive = google.drive({ version: 'v3', auth });

    let fileList: MediaFile[] = [];
    let pageToken: string | undefined = undefined;
    do {
        const response = await drive.files.list({
            q: `'${folder.id}' in parents`,
            orderBy: 'name_natural',
            pageSize: TRIAL_RUN ? 10 : 1000,
            fields: 'nextPageToken, files(id, name, size, mimeType)',
            pageToken: pageToken
        });

        pageToken = TRIAL_RUN ? undefined : response.data.nextPageToken;
        const files: MediaFile[] = response.data.files;

        if (files) {
            for (const file of files) {
                if (file.mimeType == 'application/vnd.google-apps.folder') {
                    fileList = fileList.concat(await fetchMediaFiles(auth, file));
                } else {
                    fileList.push(file);
                    console.debug(`${file.name} | ${file.id} | ${file.size}`);
                }
            }
        }
    } while (pageToken);
    return fileList;
}
