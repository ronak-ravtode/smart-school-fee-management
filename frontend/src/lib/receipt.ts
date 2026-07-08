const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export async function downloadReceipt(transactionId: string): Promise<void> {
  const url = `${API_BASE_URL}/receipts/${transactionId}/pdf`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to download receipt");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `receipt-${transactionId.substring(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(objectUrl);
}
