import express from "express";
import Multer from "multer";
import bodyParser from "body-parser";
import {Storage as GCStorage} from "@google-cloud/storage";
import vision from "@google-cloud/vision";
import dotenv from "dotenv";
import request from "request";

dotenv.config();

const storage = new GCStorage();
const client = new vision.ImageAnnotatorClient();

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.json());

const multer = Multer({
    storage: Multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

app.use(express.static('./'));

app.get("/", (req, res) => {
    res.render("form.ejs");
});

app.post("/upload", multer.single("file"), (req, res, next) => {
    if (!req.file) {
        res.status(400).send("error");
        return;
    }

    const blob = bucket.file(req.file.originalname);
    const blobStream = blob.createWriteStream();

    blobStream.on("error", (err) => {
        next(err);
    });

    blobStream.on("finish", async () => {

        const [result] = await client.landmarkDetection(`gs://${bucket.name}/${blob.name}`);
        const landmarks = result.landmarkAnnotations;

        let max = landmarks[0].score;
        let keyword = "";

        landmarks.forEach(landmark => max <= landmark.score ? (keyword = landmark.description, max = landmark.score) : 1);

        function makeUrl() {
            let serviceURL = "https://www.googleapis.com/youtube/v3/search?";

            let searchParameters = {
                q: "",
                part: "snippet",
                key: "YOU ARE API KEY",
                type: "video",
                maxResults: 2,
                regionCode: "KR",
                videoDuration: "short",
                videoLicense: "youtube"
            };

            searchParameters.q = keyword;
            searchParameters.q = encodeURI(searchParameters.q);

            Object.keys(searchParameters).forEach(parameter => serviceURL += parameter + "=" + searchParameters[parameter] + "&");

            return serviceURL
        }

        request(makeUrl(), function (err, res, body) {
            renderFnc(JSON.parse(body).items);
        })

        function renderFnc(data) {
            res.render("index.ejs", {
                keyword,
                data: data
            });
        }
    });
    blobStream.end(req.file.buffer);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT);

