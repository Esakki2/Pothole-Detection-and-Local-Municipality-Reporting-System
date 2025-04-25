Pothole Alert: Automated Detection and Local Municipality Reporting System
Overview
Pothole Alert is a web-based application designed to enhance road maintenance by identifying and reporting potholes in real time. It captures live video frames using a device's camera, processes them, logs detections with timestamps and geolocation data via the Google Maps Geocoding API, and generates a PDF report. The system automatically emails the report to the nearby taluk or municipality for swift action, improving road safety.
Features

Real-time pothole detection from live camera feed.
Geolocation-based reporting using Google Maps API.
Automated PDF generation and email dispatch to local authorities.
User-friendly interface with start/stop camera controls.
Detailed detection logs with timestamps and locations.

Tech Stack

Frontend: React, Axios, jsPDF, HTML5 Canvas, WebRTC, CSS
Backend: FastAPI, Python, Uvicorn
Utilities: ngrok, Google Maps Geocoding API
Configuration: Environment variables (e.g., VITE_API_URL, VITE_GOOGLE_MAPS_API_KEY)

Installation
Prerequisites

Node.js and npm
Python 3.12
ngrok (for exposing the server)

Setup

Clone the Repository
git clone <your-repo-url>
cd pothole-react-app


Install Frontend Dependencies
npm install


Set Up Environment Variables

Create a .env file in the root directory with:VITE_API_URL=https://<your-ngrok-url>
VITE_GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>




Install Backend Dependencies

Navigate to the server directory:cd server
pip install fastapi uvicorn python-multipart




Run the Application

Start the server:python server.py


Start ngrok (in a new terminal):ngrok http 8000


Update VITE_API_URL with the ngrok URL.
Start the React app:npm start





Usage

Open http://localhost:3000 in your browser.
Click "▶️ Start Camera" to begin monitoring.
Wait for detections, then click "🛑 Stop Camera" to generate and send the report.
Check the console and server logs for status updates.

Contributing
Feel free to submit issues or pull requests. Ensure code follows the project structure and guidelines.
License
MIT License (specify if different).
Contact
For support, reach out at [desakki123@gmail.com].
