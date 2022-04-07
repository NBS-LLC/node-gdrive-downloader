import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { performance } from 'perf_hooks';
import { authorize } from './auth';

const trialRun = true;

(async () => {
    const auth = await authorize();
    await downloadFiles(auth, '/mnt/raid1/private/selahrain');
    // TODO: Make downloads resumable
})();

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
            pageSize: trialRun ? 10 : 1000,
            fields: 'nextPageToken, files(id, name, size)',
            pageToken: pageToken
        });

        pageToken = trialRun ? undefined : response.data.nextPageToken;
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
