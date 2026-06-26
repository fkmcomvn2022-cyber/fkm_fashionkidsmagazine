// Danh sách ngân hàng hỗ trợ VietQR — lấy từ api.vietqr.io/v2/banks (2026-06-25),
// rút gọn xuống các ngân hàng phổ biến tại VN, đủ cho hầu hết studio dùng app này.
// `bin` là mã dùng trong URL ảnh QR (img.vietqr.io/image/<bin>-<so_tk>-<template>...).
export interface Bank {
  bin: string;
  code: string;
  shortName: string;
}

export const banks: Bank[] = [
  { bin: "970436", code: "VCB", shortName: "Vietcombank" },
  { bin: "970415", code: "ICB", shortName: "VietinBank" },
  { bin: "970418", code: "BIDV", shortName: "BIDV" },
  { bin: "970405", code: "VBA", shortName: "Agribank" },
  { bin: "970422", code: "MB", shortName: "MBBank" },
  { bin: "970407", code: "TCB", shortName: "Techcombank" },
  { bin: "970416", code: "ACB", shortName: "ACB" },
  { bin: "970432", code: "VPB", shortName: "VPBank" },
  { bin: "970423", code: "TPB", shortName: "TPBank" },
  { bin: "970403", code: "STB", shortName: "Sacombank" },
  { bin: "970437", code: "HDB", shortName: "HDBank" },
  { bin: "970441", code: "VIB", shortName: "VIB" },
  { bin: "970443", code: "SHB", shortName: "SHB" },
  { bin: "970429", code: "SCB", shortName: "SCB" },
  { bin: "970426", code: "MSB", shortName: "MSB" },
  { bin: "970448", code: "OCB", shortName: "OCB" },
  { bin: "970431", code: "EIB", shortName: "Eximbank" },
  { bin: "970440", code: "SEAB", shortName: "SeABank" },
  { bin: "970449", code: "LPB", shortName: "LPBank" },
  { bin: "971025", code: "MOMO", shortName: "MoMo" },
];

export const bankByBin = (bin: string) => banks.find((b) => b.bin === bin);
