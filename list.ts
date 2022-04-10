import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { authorize } from './auth';

const FULL_SEND = process.env['FULL_SEND']?.toLowerCase() === 'true';
const OUTPUT_PATH = './out';

(async () => {
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });

    const rootFolder = {
        id: '1AQ27Ov9hwjg3-KXXv-GvPq8hul4nxafV',
        name: 'Private'
    };

    const auth = await authorize();
    const modelFolders = await fetchModelFolders(auth, rootFolder);

    for (const modelFolder of modelFolders) {
        const fileFolder = await fetchFolderByName(auth, modelFolder.name);
        const mediaFiles = await fetchMediaFiles(auth, fileFolder);
        console.log(`Discovered ${mediaFiles.length} media files`);

        const outputFilename = `${path.resolve(OUTPUT_PATH)}/${modelFolder.name}_files.json`;
        fs.writeFileSync(outputFilename, JSON.stringify(mediaFiles, null, '  '), { encoding: 'utf-8' });
        console.log('Media files list written to', outputFilename);

        console.log();
    }
})();

interface FolderFile {
    id: string;
    name: string;
}

export interface MediaFile {
    id: string;
    name: string;
    size: string;
    mimeType: string;
}

/**
 * Retrieve a list of model folders.
 * @param auth An authorized OAuth2 client.
 * @param rootFolder The root folder containing the model folders.
 * @returns A promise that resolve toa  list of model folders.
 */
async function fetchModelFolders(auth: OAuth2Client, rootFolder: FolderFile): Promise<FolderFile[]> {
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.folder' and '${rootFolder.id}' in parents`,
        pageSize: 50,
        fields: 'files(id, name)',
    });

    if (response.data.files?.length) {
        return response.data.files as FolderFile[];
    } else {
        throw new Error(`Unable to retrieve model folders from "${rootFolder.name}" (${rootFolder.id}).`);
    }
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
            pageSize: FULL_SEND ? 1000 : 10,
            fields: 'nextPageToken, files(id, name, size, mimeType)',
            pageToken: pageToken
        });

        pageToken = FULL_SEND ? response.data.nextPageToken : undefined;
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
