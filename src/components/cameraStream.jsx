import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const CameraStream = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const isProcessing = useRef(false);

  const [status, setStatus] = useState('Idle');
  const [processedImage, setProcessedImage] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [detectionLog, setDetectionLog] = useState([]);
  const [location, setLocation] = useState('📍 Get Location');

  // Start the camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      await videoRef.current.play();
      setStatus('🎥 Camera Started');
      intervalRef.current = setInterval(captureAndSendFrame, 2000);
    } catch (err) {
      console.error('❌ Error accessing camera:', err);
      setStatus('❌ Camera Access Denied');
    }
  };

  // Stop the camera and send email with PDF
  const stopCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus('⛔ Camera Stopped');
  
    // Generate and send PDF report if there are pothole detections
    if (detectionLog.some(log => log.potholeCount > 0)) {
      await generateAndSendPDF(detectionLog, setStatus); // Pass detectionLog and setStatus
    } else {
      setStatus('⛔ Camera Stopped - No Potholes Detected');
    }
  };
  // Check API connection
  const checkApiConnection = async () => {
    setStatus('🔄 Checking API...');
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/ping`);
      console.log('🟢 API Response:', res.data);
      setStatus('✅ API Connected');
    } catch (error) {
      console.error('❌ API Connection Failed:', error);
      setStatus('❌ API Not Connected');
    }
  };

  // Fetch location using Geolocation API
  const fetchLocation = async () => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return "Unknown";
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

          try {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
            );
            const data = await res.json();

            if (data.status === "OK") {
              const area = data.results[0].address_components.find(comp =>
                comp.types.includes("locality") || comp.types.includes("sublocality")
              );
              const normalizedArea = area?.long_name || "Unknown";
              resolve(normalizedArea);
            } else {
              console.log('Geocoding API error:', data.status);
              resolve("Unknown");
            }
          } catch (error) {
            console.error('❌ Error fetching location:', error);
            resolve("Unknown");
          }
        },
        (error) => {
          console.error('❌ Geolocation error:', error);
          resolve("Unknown");
        }
      );
    });
  };

  // Capture frame and send for processing
  const captureAndSendFrame = async () => {
    if (!videoRef.current || isProcessing.current) return;
    isProcessing.current = true;
    setStatus('📸 Capturing Frame...');

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus('❌ Could not generate frame blob');
        isProcessing.current = false;
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      try {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/process_frame/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const { processed_image: base64Image, pothole_count = 0 } = res.data;
        const formattedImage = base64Image.startsWith('data:image') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
        
        const currentLocation = pothole_count > 0 ? await fetchLocation() : "Not fetched";

        setProcessedImage(formattedImage);
        setDetectionLog(prev => [
          ...prev,
          { 
            image: formattedImage, 
            timestamp: new Date().toLocaleString(), 
            potholeCount: pothole_count,
            location: currentLocation 
          },
        ]);

        setStatus('✅ Frame Processed');
      } catch (error) {
        setStatus(
          error.response
            ? `❌ Server Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`
            : error.request
            ? '❌ No response from server - Check CORS settings'
            : '❌ Error Sending Frame'
        );
      } finally {
        isProcessing.current = false;
      }
    }, 'image/jpeg');
  };

  // Generate PDF and send email
  const generateAndSendPDF = async (detectionLog, setStatus) => {
  if (!Array.isArray(detectionLog)) {
    setStatus('❌ detectionLog must be an array');
    return;
  }

  try {
    setStatus('📄 Generating PDF...');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Pothole Detection Report', 10, 15);
    let yPosition = 30;

    const potholeLogs = detectionLog.filter(log => log.potholeCount > 0);
    if (potholeLogs.length === 0) {
      doc.text('No potholes detected', 10, yPosition);
      setStatus('⚠️ No pothole data to report');
      return;
    }

    potholeLogs.forEach((log, index) => {
      doc.setFontSize(12);
      doc.text(`Detection #${index + 1}`, 10, yPosition);
      yPosition += 6;
      doc.text(`Timestamp: ${log.timestamp}`, 10, yPosition);
      yPosition += 6;
      doc.text(`Potholes Detected: ${log.potholeCount}`, 10, yPosition);
      yPosition += 6;
      doc.text(`Location: ${log.location}`, 10, yPosition);
      yPosition += 6;

      try {
        doc.addImage(log.image, 'JPEG', 10, yPosition, 160, 120);
        yPosition += 130;
      } catch (imgError) {
        console.error('❌ Error adding image:', imgError);
        doc.text('Image unavailable', 10, yPosition);
        yPosition += 10;
      }

      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
    });

    const pdfBlob = doc.output('blob');
    if (pdfBlob.size === 0) {
      throw new Error('Generated PDF is empty');
    }

    const latestPothole = potholeLogs[potholeLogs.length - 1];
    const emailLocation = latestPothole?.location || 'Unknown';

    // Prepare FormData with required fields
    const formData = new FormData();
    formData.append('to_email', 'admin@example.com'); // Replace with a valid recipient
    formData.append('subject', 'Pothole Detection Report');
    formData.append('body', `Pothole report for location: ${emailLocation}. See attached PDF.`);
    formData.append('pdf_file', pdfBlob, 'pothole_report.pdf');
    formData.append('location', emailLocation);

    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    setStatus('📧 Sending email...');
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/send_email/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    console.log('API Response:', res.data);
    setStatus(`📧 ${res.data.message}`);

    setStatus('📄 Downloading PDF...');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pothole_report.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatus('📄 PDF Generated, Emailed, and Downloaded');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    setStatus(`❌ Error: ${error.response?.data?.detail || error.message}`);
  }
};

  // Toggle result image visibility
  const toggleResultImage = () => {
    if (!detectionLog.length) {
      alert('❗ No processed images yet. Capture a frame first.');
      return;
    }
    setShowResult(prev => !prev);
  };

  // Fetch user location
  const handleFetchLocation = async () => {
    const currentLocation = await fetchLocation();
    setLocation(`📍 ${currentLocation}`);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-2">Pothole Detection</h1>
      <h2 className="text-xl text-gray-700 mb-4">🚴 Live Camera Detection</h2>

      <video
        ref={videoRef}
        width="320"
        height="240"
        className="rounded-lg shadow-md border"
      />

      <div className="mt-4 flex flex-wrap justify-center gap-3 transition duration-200">
        <button
          className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg"
          onClick={checkApiConnection}
        >
          🔌 Check API
        </button>
        <button
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg"
          onClick={startCamera}
        >
          ▶️ Start Camera
        </button>
        <button
          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg"
          onClick={stopCamera}
        >
          🛑 Stop Camera
        </button>
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          onClick={toggleResultImage}
        >
           {showResult ? '🔒 Hide Results' : '🔍 Show Results'}
        </button>
        <button
           className="bg-sky-950 hover:bg-sky-800 text-white px-4 py-2 rounded-lg"
          onClick={handleFetchLocation}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '8px 12px',
            borderRadius: '6px',
          }}
        >
          {location}
        </button>
      </div>

      <p className="mt-4 text-lg text-gray-600">Status: {status}</p>

      {showResult && detectionLog.length > 0 && (
        <div className="mt-8 w-full max-w-xl">
          <h3 className="text-xl font-semibold mb-4 text-center">🧾 Detection Results</h3>
          {detectionLog.map((item, index) => (
            <div key={index} className="mb-6 border rounded-lg p-4 shadow">
              <img src={item.image} alt={`Detection ${index + 1}`} className="rounded w-full h-auto" />
              <p className="mt-2 text-gray-700 text-sm">
                🕳️ {item.timestamp} | Potholes: {item.potholeCount}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraStream;
