import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { authorize } from './auth';
import { MediaFile } from './list';

const FULL_SEND = process.env['FULL_SEND']?.toLowerCase() === 'true';
const FILES_PATH = './out';
const MODEL_NAME = process.env['MODEL_NAME']?.toLowerCase();
const DOWNLOAD_PATH = '/mnt/raid1/private';

(async () => {
    if(!MODEL_NAME) {
        throw new Error('The MODEL_NAME environment variable must be set.');
    }

    const fileListPath = path.resolve(`${FILES_PATH}/${MODEL_NAME}_files.json`);
    const downloadPath = path.resolve(`${DOWNLOAD_PATH}/${MODEL_NAME}`);

    const fileList: MediaFile[] = JSON.parse(fs.readFileSync(fileListPath, { encoding: 'utf-8' }));
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log(`Read ${fileList.length} files.`);

    const fileListSlices = createSlices(fileList, 25);
    console.log(`Slicing the file list into ${fileListSlices.length} parts.`);

    const auth = await authorize();
    const results = await Promise.allSettled(fileListSlices.map(async (slice) => {
        return await downloadFiles(auth, slice, downloadPath);
    }));

    displayDownloadStats(results);
})();

interface DownloadStats {
    count: number;
    totalSizeBytes: number;
}

function displayDownloadStats(results: PromiseSettledResult<DownloadStats>[]) {
    let count = 0;
    let totalSizeMB = 0;
    for (const result of results) {
        if (result.status == 'fulfilled') {
            count += result.value.count;
            totalSizeMB += Math.floor((result.value.totalSizeBytes) / (1024 * 1024));
        }
    }
    console.log(`Download ${count} media files (${totalSizeMB}MB).`);
}

async function downloadFiles(auth: OAuth2Client, fileList: MediaFile[], destination: string): Promise<DownloadStats> {
    let count = 0;
    let totalSizeBytes = 0;

    for (const file of fileList) {
        if (!FULL_SEND && count >= 10) {
            break;
        }

        if (!isDownloaded(file, destination)) {
            await downloadFile(auth, file, destination);
            count++;
            totalSizeBytes += parseInt(file.size, 10);
        }
    }

    return { count, totalSizeBytes };
}

async function downloadFile(auth: OAuth2Client, file: MediaFile, destination: string) {
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });

    const destFullPath = `${destination}/${file.name}`;
    fs.writeFileSync(destFullPath, Buffer.from(response.data as ArrayBuffer), 'binary');
    console.log(`Downloaded file to: ${destFullPath}.`);
}

function isDownloaded(file: MediaFile, destination: string): boolean {
    try {
        const fileStats = fs.statSync(`${destination}/${file.name}`);
        return fileStats.size == parseInt(file.size, 10);
    } catch {
        return false;
    }
}

function createSlices(fileList: MediaFile[], sliceCount = 10): MediaFile[][] {
    const slices: MediaFile[][] = [];

    const sliceSize = Math.ceil(fileList.length / sliceCount);
    for (let i = 0; i < fileList.length; i += sliceSize) {
        slices.push(fileList.slice(i, i + sliceSize));
    }

    return slices;
}