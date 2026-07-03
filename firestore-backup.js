import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SERVICE_ACCOUNT_PATH) {
  console.error("Erro: defina GOOGLE_APPLICATION_CREDENTIALS apontando para o arquivo da chave de serviço.");
  process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Erro: arquivo da chave não encontrado em: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

function isDocumentReference(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.path === "string" &&
    typeof value.id === "string" &&
    typeof value.get === "function"
  );
}

function serializeValue(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof GeoPoint) {
    return { _type: "GeoPoint", latitude: value.latitude, longitude: value.longitude };
  }

  if (isDocumentReference(value)) {
    return { _type: "DocumentReference", path: value.path };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeValue(v)])
    );
  }

  return value;
}

function serializeDoc(doc) {
  return {
    id: doc.id,
    path: doc.ref.path,
    data: serializeValue(doc.data()),
  };
}

async function backupCollection(collectionRef, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    const docDir = path.join(outputDir, doc.id);
    fs.mkdirSync(docDir, { recursive: true });
    fs.writeFileSync(
      path.join(docDir, "data.json"),
      JSON.stringify(serializeDoc(doc), null, 2)
    );

    const subcollections = await doc.ref.listCollections();
    for (const sub of subcollections) {
      await backupCollection(sub, path.join(docDir, sub.id));
    }
  }
}

async function main() {
  const rootCollectionIds = ["users"];
  const backupDir = `firestore-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  for (const id of rootCollectionIds) {
    console.log(`Exportando coleção: ${id}...`);
    await backupCollection(db.collection(id), path.join(backupDir, id));
  }

  console.log(`Backup concluído em: ./${backupDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
