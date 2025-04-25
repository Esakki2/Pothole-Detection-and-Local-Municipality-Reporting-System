# === Imports ===
import os, io, json, base64, smtplib, nest_asyncio, uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import aiosmtplib
from PIL import Image
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pyngrok import ngrok
from ultralytics import YOLO
import cv2
import numpy as np

# === Config ===
# === Config ===
NGROK_AUTH_TOKEN = "2tigUqsNWl4hE0f3rWrAzIkalpC_3B3fMSbFPnYZmeBUUwqv6"
MODEL_PATH = r"C:\Users\ESAKKI\Desktop\fy\models\content\runs\detect\train\weights\best.pt"
JSON_PATH = r"C:\Users\ESAKKI\Desktop\final-yr - Copy - Copy\pothole-react-app\server\municipalities.json"

EMAIL_SENDER = "potholereporter3@gmail.com"
EMAIL_PASSWORD = "vyutstqkqzxaiwgd"
FALLBACK_EMAIL = "info@chennaicorporation.gov.in"


# === FastAPI Setup ===
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Load resources ===
try:
    with open(JSON_PATH, 'r') as f:
        municipality_data = json.load(f)
    print("✅ Municipality data loaded.")
except Exception as e:
    raise FileNotFoundError(f"❌ Error loading municipality JSON: {e}")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError("❌ YOLO model not found!")
model = YOLO(MODEL_PATH)
print("✅ YOLO model loaded.")

# === Routes ===

@app.get("/")
def home():
    return {"message": "Pothole Detection API is active."}

@app.get("/ping")
def ping():
    return {"message": "API is working fine!"}

@app.post("/process_frame/")
async def process_frame(file: UploadFile = File(...)):
    try:
        img_bytes = await file.read()
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        results = model(image, conf=0.3, iou=0.5)

        detections = []
        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0].cpu())
                x_min, y_min, x_max, y_max = map(int, box.xyxy[0].cpu().numpy())
                class_id = int(box.cls[0].cpu())
                class_name = model.names[class_id]

                detections.append({
                    "x_min": x_min, "y_min": y_min,
                    "x_max": x_max, "y_max": y_max,
                    "confidence": conf,
                    "class_name": class_name
                })

                cv2.rectangle(img_cv, (x_min, y_min), (x_max, y_max), (0, 255, 0), 2)
                cv2.putText(img_cv, f"{class_name} {conf:.2f}", (x_min, y_min - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        _, encoded_img = cv2.imencode(".jpg", img_cv)
        b64_img = base64.b64encode(encoded_img).decode("utf-8")
        image_data_url = f"data:image/jpeg;base64,{b64_img}"

        pothole_count = sum(1 for d in detections if d["class_name"].lower() == "pothole")

        return {
            "pothole_count": pothole_count,
            "detections": detections,
            "processed_image": image_data_url
        }

    except Exception as e:
        print(f"❌ Frame processing error: {e}")
        return {"error": f"Failed to process frame: {e}"}

@app.post("/send_email/")
async def send_email(location: str = Form(...), pdf_file: UploadFile = File(...)):
    print(f"Received location: {location}")
    print(f"Received pdf_file: {pdf_file.filename}, size: {pdf_file.size}, type: {pdf_file.content_type}")
    
    if pdf_file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        recipient_email = FALLBACK_EMAIL
        normalized_location = location.strip().lower()

        for key in municipality_data:
            if normalized_location in key.lower():
                recipient_email = municipality_data[key].get("email", FALLBACK_EMAIL)
                break

        pdf_bytes = await pdf_file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="PDF file is empty")

        message = MIMEMultipart()
        message['From'] = EMAIL_SENDER
        message['To'] = recipient_email
        message['Subject'] = f"Pothole Report: {location}"

        body = f"""Dear Authority,

Attached is a pothole report for: {location}.
Please review and take action accordingly.

Best,
Pothole Detection System
"""
        message.attach(MIMEText(body, 'plain'))

        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{pdf_file.filename}"')
        message.attach(part)

        await aiosmtplib.send(
            message,
            hostname='smtp.gmail.com',
            port=465,
            username=EMAIL_SENDER,
            password=EMAIL_PASSWORD,
            use_tls=True
        )

        print(f"✅ Email sent to {recipient_email}")
        return {"message": f"Email sent to {recipient_email}"}

    except Exception as e:
        print(f"❌ Email error: {e}")
        raise HTTPException(status_code=500, detail=f"Email send failed: {e}")

# === Ngrok Launcher ===
def run_server():
    try:
        ngrok.set_auth_token(NGROK_AUTH_TOKEN)
        public_url = ngrok.connect(8000, bind_tls=True).public_url
        print(f"🌍 Server running at: {public_url}")

        nest_asyncio.apply()
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except Exception as e:
        print(f"❌ Failed to launch server: {e}")

# === Main Entrypoint ===
if __name__ == "__main__":
    run_server()
