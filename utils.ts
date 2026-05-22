export const formatWeight = (kg: string | number | undefined): string => {
  if (kg === undefined || kg === null || kg === '') return '-';
  
  // Clean the input string to get just numbers/decimals
  const numericString = String(kg).replace(/[^0-9.]/g, '');
  const totalKg = parseFloat(numericString);
  
  if (isNaN(totalKg) || totalKg === 0) return String(kg);

  const mt = Math.floor(totalKg / 1000);
  const remainingKg = Math.round((totalKg % 1000) * 100) / 100; // Round to 2 decimal places

  let parts = [];
  if (mt > 0) parts.push(`${mt} MT`);
  if (remainingKg > 0 || mt === 0) parts.push(`${remainingKg} Kg`);

  return parts.join(' ');
};

export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};