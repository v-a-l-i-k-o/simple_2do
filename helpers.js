function stringFromUTF8Array(data) {
    const extraByteMap = [1, 1, 1, 1, 2, 2, 3, 0];
    const count = data.length;
    let str = "";

    for (let index = 0; index < count;) {
        let ch = data[index++];
        if (ch & 0x80) {
            let extra = extraByteMap[(ch >> 3) & 0x07];
            if (!(ch & 0x40) || !extra || ((index + extra) > count))
                return null;

            ch = ch & (0x3F >> extra);
            for (; extra > 0; extra -= 1) {
                let chx = data[index++];
                if ((chx & 0xC0) != 0x80)
                    return null;

                ch = (ch << 6) | (chx & 0x3F);
            }
        }

        str += String.fromCharCode(ch);
    }
    log('TODO: Get string from UTF8Array');

    return str;
}
