
import crypto from 'crypto';
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 9;

// export function normalizeNZPhone(phone) {
//     // Remove spaces, dashes etc
//     phone = phone.replace(/\D/g, "");
//     // If already starts with 64 (international without +)
//     if (phone.startsWith("64")) {
//         return `+${phone}`;
//     }
//     // If starts with 0, convert to +64
//     if (phone.startsWith("0")) {
//         return `+64${phone.substring(1)}`;
//     }
//     // If user enters 9-digit mobile w/out 0
//     return `+64${phone}`;
// }

export function normalizeNZPhone(phone) {
    phone = phone.replace(/\D/g, "");

    if (phone.startsWith("64")) phone = `+${phone}`;
    else if (phone.startsWith("0")) phone = `+64${phone.substring(1)}`;
    else phone = `+64${phone}`;

    // Optional: basic NZ number validation (mobile or landline)
    if (!/^(\+64)(2\d{1,2}|[3-9]\d)\d{6,7}$/.test(phone)) {
        throw new Error("Invalid NZ phone number");
    }

    return phone;
}

export function generateShortId(size = DEFAULT_LENGTH) {
    let shortUUID = "";
    const bytes = crypto.randomBytes(size);
    for (let i = 0; i < size; i++) {
        shortUUID += CHARACTERS[bytes[i] % CHARACTERS.length];
    }
    return shortUUID;
}
