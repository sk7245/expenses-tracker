const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

let localServer = null;

async function connectDatabase(uri) {
    if (!uri) {
        // no MONGODB_URI: run a local MongoDB that keeps its data in .data/db
        // (only for development; production always needs a real database)
        const { MongoMemoryServer } = require("mongodb-memory-server");
        const dbPath = path.join(__dirname, "..", ".data", "db");
        fs.mkdirSync(dbPath, { recursive: true });

        localServer = await MongoMemoryServer.create({
            instance: { dbPath, storageEngine: "wiredTiger" }
        });
        uri = localServer.getUri("expenses-tracker");
        console.log("No MONGODB_URI set - using the local database in .data/db");
    }

    await mongoose.connect(uri);
}

async function disconnectDatabase() {
    await mongoose.disconnect();
    if (localServer) {
        await localServer.stop();
        localServer = null;
    }
}

module.exports = { connectDatabase, disconnectDatabase };
