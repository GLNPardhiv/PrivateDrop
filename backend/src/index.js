import app from "./app.js";
import connectDB from "./db/db.js";
import { connectToGridFS, cleanupExpiredFiles } from "./services/gridfs.services.js";

const PORT = process.env.PORT || 8000;

connectDB()
    .then(() => {
        connectToGridFS()
        
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(`Error connecting to the database: ${error.message}`);
        process.exit(1);
    });

setInterval(cleanupExpiredFiles, 5 * 60 * 1000); // every 5 minutes

cleanupExpiredFiles();