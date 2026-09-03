import multer from "multer";

// Keep files in memory — we stream them straight to Blob Storage,
// so there is no need to write to disk first.
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
    storage,

    // 20 MB limit — reasonable for clinical PDFs
    limits: {
        fileSize: 20 * 1024 * 1024,
    },

    fileFilter(_req, file, callback) {
        if (file.mimetype === "application/pdf") {
            callback(null, true);
        } else {
            callback(new Error("Only PDF files are accepted"));
        }
    },
}).single("file"); // the multipart field name the client must use
