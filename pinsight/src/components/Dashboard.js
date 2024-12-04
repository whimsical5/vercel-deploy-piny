import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard = () => {
    const [images, setImages] = useState([]);

    useEffect(() => {
        const fetchImages = async () => {
            const response = await axios.get('http://localhost:5001/user-images');
            setImages(response.data);
        };

        fetchImages();
    }, []);

    return (
        <div>
            <h1>Your Pinterest Images</h1>
            <div>
                {images.map((img, index) => (
                    <img key={index} src={img.url} alt="Pinterest" />
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
