const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

app.post('/analyze-image', async (req, res) => {
    const { imageUrl } = req.body;

    try {
        const [result] = await client.annotateImage({
            image: { source: { imageUri: imageUrl } },
            features: [
                { type: 'LABEL_DETECTION' },
                { type: 'FACE_DETECTION' },
            ],
        });

        res.json(result);
    } catch (error) {
        res.status(500).send(error.message);
    }
});
