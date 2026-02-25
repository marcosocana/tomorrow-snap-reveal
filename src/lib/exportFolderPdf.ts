import jsPDF from "jspdf";
import { getEventStatus } from "@/lib/eventStatus";

interface ExportEvent {
  id: string;
  name: string;
  password_hash: string;
  reveal_time: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  expiry_date: string | null;
}

interface ExportFolder {
  id: string;
  name: string;
  custom_image_url: string | null;
}

// Convert image URL to base64
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
  }
}

// Generate QR code as base64 from a hidden canvas
async function generateQRBase64(url: string, size: number = 200): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const { QRCodeSVG } = await import("qrcode.react");
      const { createRoot } = await import("react-dom/client");
      const React = await import("react");

      const qrWrapper = document.createElement("div");
      container.appendChild(qrWrapper);

      const root = createRoot(qrWrapper);
      root.render(React.createElement(QRCodeSVG, { value: url, size, level: "H" }));

      // Wait for render
      await new Promise((r) => setTimeout(r, 150));

      const svgElement = qrWrapper.querySelector("svg");
      if (!svgElement) {
        throw new Error("No se pudo generar el QR");
      }

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("No se pudo crear el canvas");
      }

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL("image/png");

        URL.revokeObjectURL(blobUrl);
        root.unmount();
        document.body.removeChild(container);

        resolve(dataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        root.unmount();
        document.body.removeChild(container);
        reject(new Error("Error al cargar la imagen del QR"));
      };

      img.src = blobUrl;
    } catch (error) {
      reject(error);
    }
  });
}

export async function exportFolderToPdf(
  folder: ExportFolder,
  events: ExportEvent[],
  onProgress?: (progress: number) => void
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Header with folder name
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text(folder.name, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Add folder custom image if exists
  if (folder.custom_image_url) {
    const imageBase64 = await imageUrlToBase64(folder.custom_image_url);
    if (imageBase64) {
      try {
        const maxImageWidth = 60;
        const maxImageHeight = 30;

        // Create an image to get natural dimensions
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = imageBase64;
        });

        // Calculate scaled dimensions maintaining aspect ratio
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let imgWidth = maxImageWidth;
        let imgHeight = imgWidth / aspectRatio;

        if (imgHeight > maxImageHeight) {
          imgHeight = maxImageHeight;
          imgWidth = imgHeight * aspectRatio;
        }

        // Add image centered
        const imgX = (pageWidth - imgWidth) / 2;
        pdf.addImage(imageBase64, "AUTO", imgX, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (error) {
        console.error("Error adding folder image:", error);
      }
    }
  }

  // Separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Generate each event
  const qrSize = 50;
  const eventHeight = 70;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    onProgress?.(Math.round(((i + 1) / events.length) * 100));

    // Check if we need a new page
    if (yPosition + eventHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
    const statusInfo = getEventStatus(
      event.upload_start_time,
      event.upload_end_time,
      event.reveal_time,
      event.expiry_date
    );

    // Generate QR
    try {
      const qrBase64 = await generateQRBase64(eventUrl, 200);

      // Draw event box
      const boxX = margin;
      const boxWidth = pageWidth - 2 * margin;
      const boxHeight = eventHeight - 5;

      pdf.setFillColor(250, 250, 250);
      pdf.setDrawColor(220, 220, 220);
      pdf.roundedRect(boxX, yPosition, boxWidth, boxHeight, 3, 3, "FD");

      // Add QR code
      const qrX = boxX + 5;
      const qrY = yPosition + 5;
      pdf.addImage(qrBase64, "PNG", qrX, qrY, qrSize, qrSize);

      // Event name and status
      const textX = qrX + qrSize + 10;
      const textY = yPosition + 15;

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text(event.name, textX, textY);

      // Password
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Contraseña: ${event.password_hash}`, textX, textY + 8);

      // Status badge
      const statusY = textY + 20;

      // Set status colors
      let statusBgColor: [number, number, number];
      let statusTextColor: [number, number, number];

      switch (statusInfo.status) {
        case "not_started":
          statusBgColor = [240, 240, 240];
          statusTextColor = [100, 100, 100];
          break;
        case "in_progress":
          statusBgColor = [219, 234, 254];
          statusTextColor = [37, 99, 235];
          break;
        case "finished":
          statusBgColor = [254, 243, 199];
          statusTextColor = [217, 119, 6];
          break;
        case "revealed":
          statusBgColor = [209, 250, 229];
          statusTextColor = [5, 150, 105];
          break;
        case "expired":
          statusBgColor = [254, 226, 226];
          statusTextColor = [220, 38, 38];
          break;
        default:
          statusBgColor = [240, 240, 240];
          statusTextColor = [100, 100, 100];
      }

      const statusWidth = pdf.getTextWidth(statusInfo.label) + 10;
      const statusHeight = 7;

      pdf.setFillColor(...statusBgColor);
      pdf.roundedRect(textX, statusY - 5, statusWidth, statusHeight, 2, 2, "F");

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...statusTextColor);
      pdf.text(statusInfo.label, textX + 5, statusY);

      yPosition += eventHeight;
    } catch (error) {
      console.error(`Error generating QR for event ${event.name}:`, error);
      yPosition += eventHeight;
    }
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(150, 150, 150);
  const footerText = `Generado por Revelao.cam - ${new Date().toLocaleDateString("es-ES")}`;
  pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });

  // Download PDF
  const fileName = `${folder.name.replace(/\s+/g, "-").toLowerCase()}-eventos.pdf`;
  pdf.save(fileName);
}
