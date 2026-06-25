import { google } from 'googleapis';
import { readFileSync } from 'fs';

const DOCUMENT_ID = '17PVLXNVrqULgXX_jTZCDIteVe4WzWiYv1SUoy66jqDE';
const tokenPath = `${process.env.HOME}/.config/google-docs-mcp/token.json`;
const token = JSON.parse(readFileSync(tokenPath, 'utf8'));

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
auth.setCredentials(token);
const docs = google.docs({ version: 'v1', auth });

async function main() {
  // Step 1: Read document
  console.log('=== Step 1: Read current state ===');
  const doc = await docs.documents.get({ documentId: DOCUMENT_ID });
  const body = doc.data.body.content;
  const lastElem = body[body.length - 1];
  const fullEnd = lastElem.endIndex;

  let bulletCount = body.filter(e => e.paragraph?.bullet).length;
  let totalParas = body.filter(e => e.paragraph).length;
  console.log(`  ${bulletCount}/${totalParas} paragraphs have bullets (endIndex=${fullEnd})`);

  // Step 2: Corrupt - add bullets to ALL paragraphs
  console.log('\n=== Step 2: Corrupting document (adding bullets to all paragraphs) ===');
  await docs.documents.batchUpdate({
    documentId: DOCUMENT_ID,
    requestBody: {
      requests: [{
        createParagraphBullets: {
          range: { startIndex: 1, endIndex: fullEnd },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
        }
      }]
    }
  });

  // Verify corruption
  const doc2 = await docs.documents.get({ documentId: DOCUMENT_ID });
  const body2 = doc2.data.body.content;
  bulletCount = body2.filter(e => e.paragraph?.bullet).length;
  totalParas = body2.filter(e => e.paragraph).length;
  console.log(`  ${bulletCount}/${totalParas} paragraphs now have bullets`);

  console.log('\n=== Document is now corrupted. Ready for replaceDocumentWithMarkdown test. ===');
}

main().catch(e => { console.error(e.message); process.exit(1); });
