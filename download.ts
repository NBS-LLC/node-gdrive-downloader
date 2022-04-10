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

    let count = 0;
    for (const file of fileList) {
        if (TRIAL_RUN && count >= 10) {
            break;
        }

        await downloadFile(auth, file.id, file.name, downloadPath);
        count++;
    }
})();

async function downloadFile(auth: OAuth2Client, fileId: string, filename: string, destination: string) {
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'arraybuffer' });

    const destFullPath = `${destination}/${filename}`;
    fs.writeFileSync(destFullPath, Buffer.from(response.data as ArrayBuffer), 'binary');
    console.log(`Downloaded file to: ${destFullPath}.`);
}