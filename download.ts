import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { authorize } from './auth';
import { MediaFile } from './list';

const TRIAL_RUN = true;
const FILES_PATH = './out';
const MODEL_NAME = 'judith';
const DOWNLOAD_PATH = '/mnt/raid1/private';

(async () => {
    const fileListPath = path.resolve(`${FILES_PATH}/${MODEL_NAME}_files.json`);
    const downloadPath = path.resolve(`${DOWNLOAD_PATH}/${MODEL_NAME}`);

    const fileList: MediaFile[] = JSON.parse(fs.readFileSync(fileListPath, { encoding: 'utf-8' }));
    fs.mkdirSync(downloadPath, { recursive: true });

    console.log(`Read ${fileList.length} files.`);

    const auth = await authorize();
    const count = await downloadFiles(auth, fileList, downloadPath);

    console.log(`Download ${count} media files.`);
})();

async function downloadFiles(auth: OAuth2Client, fileList: MediaFile[], destination: string): Promise<number> {
    let count = 0;
    for (const file of fileList) {
        if (TRIAL_RUN && count >= 10) {
            break;
        }

        await downloadFile(auth, file, destination);
        count++;
    }

    return count;
}

async function downloadFile(auth: OAuth2Client, file: MediaFile, destination: string) {
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });

    const destFullPath = `${destination}/${file.name}`;
    fs.writeFileSync(destFullPath, Buffer.from(response.data as ArrayBuffer), 'binary');

    const fileStats = fs.statSync(destFullPath);
    if (fileStats.size == parseInt(file.size, 10)) {
        console.log(`Downloaded file to: ${destFullPath}.`);
    } else {
        console.error(`An error occurred while downloading: ${file.name}.`);
    }
}
