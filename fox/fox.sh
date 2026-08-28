#!/bin/bash

# ============================================================
#  ███████╗ ██████╗ ██╗  ██╗
#  ██╔════╝██╔═══██╗╚██╗██╔╝
#  █████╗  ██║   ██║ ╚███╔╝
#  ██╔══╝  ██║   ██║ ██╔██╗
#  ██║     ╚██████╔╝██╔╝ ██╗
#  ╚═╝      ╚═════╝ ╚═╝  ╚═╝
#
#  FOX OPERATION MANAGER
#  Usage: source fox.sh  (atau ./fox.sh <command>)
# ============================================================

FOX_HOME="/root/fox"
OPS_DIR="$FOX_HOME/operations"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

banner() {
    echo -e "${RED}"
    echo '  ______  ____   __  __'
    echo ' |  ____|/ __ \ / _|/ _|'
    echo ' | |__  | |  | | |_| |_'
    echo ' |  __| | |  | |  _|  _|'
    echo ' | |    | |__| | | | |'
    echo ' |_|     \____/|_| |_|'
    echo -e "${NC}"
    echo -e "${YELLOW}Fox Operation Manager${NC}"
    echo ""
}

show_help() {
    banner
    echo -e "${CYAN}USAGE:${NC}"
    echo "  ./fox.sh <command> [args]"
    echo "  source fox.sh  (load functions ke shell)"
    echo ""
    echo -e "${CYAN}COMMANDS:${NC}"
    echo ""
    echo -e "  ${GREEN}new${NC} <target> <ip>       Buat operasi baru (nanya lokasi storage)"
    echo -e "  ${GREEN}list${NC}                   List semua operasi aktif"
    echo -e "  ${GREEN}open${NC} <target>           Buka file target info"
    echo -e "  ${GREEN}rm${NC} <target>             Hapus operasi (archive dulu)"
    echo -e "  ${GREEN}status${NC} <target>         Lihat status target"
    echo -e "  ${GREEN}note${NC} <target> <text>    Tambah catatan cepat ke target"
    echo -e "  ${GREEN}notes${NC} <target>          Lihat semua catatan target"
    echo -e "  ${GREEN}stash${NC} <target>          ⭐ Simpan hasil temuan (interactive)"
    echo -e "  ${GREEN}recon-add${NC} <target>      Tambah hasil recon (interactive)"
    echo ""
    echo -e "  ${GREEN}flow${NC}                    Tampilkan kill chain flow"
    echo -e "  ${GREEN}skills${NC}                  Tampilkan skill matrix"
    echo -e "  ${GREEN}manifest${NC}                Tampilkan fox manifest"
    echo ""
    echo -e "  ${GREEN}help${NC}                    Tampilkan help ini"
    echo ""
    echo -e "${CYAN}EXAMPLES:${NC}"
    echo "  ./fox.sh new example.com 10.10.10.1"
    echo "  ./fox.sh list"
    echo "  ./fox.sh open example.com"
    echo "  ./fox.sh stash target.com"
    echo "  ./fox.sh note example.com 'Found SQLi at /products.php?id=1'"
    echo ""
}

# ============================================================
# COMMAND: new — Create new target operation (WITH STORAGE PROMPT)
# ============================================================
cmd_new() {
    local target="$1"
    local ip="$2"

    if [[ -z "$target" || -z "$ip" ]]; then
        echo -e "${RED}Usage: fox new <target> <ip>${NC}"
        return 1
    fi

    # Cek apakah udah ada
    local default_dir="$OPS_DIR/$target"
    if [[ -d "$default_dir" ]]; then
        echo -e "${YELLOW}[!] Target '$target' already exists!${NC}"
        echo -e "${YELLOW}    Use 'fox open $target' to view it.${NC}"
        return 1
    fi

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     🦊 FOX — TARGET STORAGE LOCATION       ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Target:${NC} $target ($ip)"
    echo ""
    echo -e "${BLUE}Mau simpan hasil operasi di mana?${NC}"
    echo -e "${YELLOW}  Lokasi storage (folder):${NC}"
    echo -e "    ${GREEN}Enter${NC} = default → ${WHITE}$default_dir${NC}"
    echo -e "    Atau ketik path kustom, misal:"
    echo -e "      ${WHITE}/root/project/${target}${NC}"
    echo -e "      ${WHITE}/mnt/hack/${target}${NC}"
    echo -e "      ${WHITE}./${target}${NC}"
    echo ""
    echo -e "${PURPLE}  ➤  Nama folder:${NC} ${WHITE}${target}${NC}"
    read -p "  Lokasi (enter = default): " custom_path

    local dir
    if [[ -z "$custom_path" ]]; then
        dir="$default_dir"
    else
        # If relative path, resolve relative to OPS_DIR
        if [[ "$custom_path" != /* ]]; then
            dir="$OPS_DIR/$custom_path"
        else
            dir="$custom_path"
        fi
    fi

    # Cek kalo folder udah ada
    if [[ -d "$dir" ]]; then
        echo -e "${YELLOW}[!] Folder '$dir' already exists!${NC}"
        echo -e "${YELLOW}    Menggunakan folder yang ada.${NC}"
    else
        mkdir -p "$dir"/{recon,vulns,creds,payloads,loot,exploits}
    fi

    # Copy template
    cp "$OPS_DIR/template/TARGET.md" "$dir/TARGET.md"
    sed -i "s/\[NAMA TARGET\]/$target/g" "$dir/TARGET.md"
    sed -i "s/example.com/$target/g" "$dir/TARGET.md"
    sed -i "s/10.10.10.1/$ip/g" "$dir/TARGET.md"
    sed -i "s|Storage Path   :.*|Storage Path   : $dir|" "$dir/TARGET.md"
    sed -i "s/Date Added    :.*/Date Added    : $(date +%Y-%m-%d)/" "$dir/TARGET.md"

    # Simpan lokasi sebenarnya di file metadata
    echo "$dir" > "$default_dir/.location" 2>/dev/null || true

    # Kalo pake custom path, bikin symlink dari default ke custom biar gampang ditemuin
    if [[ "$dir" != "$default_dir" ]]; then
        mkdir -p "$(dirname "$default_dir")"
        ln -sf "$dir" "$default_dir" 2>/dev/null || true
        echo ""
        echo -e "${YELLOW}  ⚡ Symlink dibuat:${NC}"
        echo -e "     ${WHITE}$default_dir${NC} → ${WHITE}$dir${NC}"
    fi

    echo ""
    echo -e "${GREEN}┌─────────────────────────────────────────────┐${NC}"
    echo -e "${GREEN}│  ✅ TARGET CREATED                         │${NC}"
    echo -e "${GREEN}└─────────────────────────────────────────────┘${NC}"
    echo -e "  ${YELLOW}Target:${NC}  $target"
    echo -e "  ${YELLOW}IP:${NC}      $ip"
    echo -e "  ${YELLOW}Storage:${NC} $dir"
    echo ""
    echo -e "  ${BLUE}Subfolders:${NC}"
    echo -e "    ${GREEN}recon/${NC}     → hasil scanning & enumeration"
    echo -e "    ${GREEN}vulns/${NC}     → vulnerability details & PoC"
    echo -e "    ${GREEN}creds/${NC}     → credentials, hash, token"
    echo -e "    ${GREEN}payloads/${NC}  → shellcode, exploit, backdoor"
    echo -e "    ${GREEN}loot/${NC}      → database dump, data exfil"
    echo -e "    ${GREEN}exploits/${NC}  → exploit scripts & tools"
    echo ""
    echo -e "  ${BLUE}Next steps:${NC}"
    echo -e "    ${WHITE}fox open $target${NC}     → lihat & edit TARGET.md"
    echo -e "    ${WHITE}fox stash $target${NC}    → simpan hasil temuan"
    echo -e "    ${WHITE}fox note $target ...${NC}  → catat progress"
    echo ""
}

# ============================================================
# COMMAND: list — List all operations
# ============================================================
cmd_list() {
    banner
    echo -e "${CYAN}ACTIVE OPERATIONS:${NC}"
    echo ""

    local found=0
    for dir in "$OPS_DIR"/*/; do
        local name=$(basename "$dir")
        [[ "$name" == "template" ]] && continue
        [[ "$name" == "archive" ]] && continue

        local status="NEW"
        local target_file="$dir/TARGET.md"
        if [[ -f "$target_file" ]]; then
            status=$(grep "^Status" "$target_file" 2>/dev/null | awk -F': ' '{print $2}' | head -1)
        fi

        local ip=$(grep "^IP" "$target_file" 2>/dev/null | awk -F': ' '{print $2}' | head -1)

        echo -e "  ${RED}[${status}]${NC} ${GREEN}$name${NC} ${BLUE}$ip${NC}"
        echo -e "      ${YELLOW}Dir:${NC} $dir"
        echo ""
        found=1
    done

    if [[ $found -eq 0 ]]; then
        echo -e "  ${YELLOW}No active operations.${NC}"
        echo -e "  ${YELLOW}Create one with: fox new <target> <ip>${NC}"
    fi
}

# ============================================================
# COMMAND: open — Open target file
# ============================================================
cmd_open() {
    local target="$1"
    if [[ -z "$target" ]]; then
        echo -e "${RED}Usage: fox open <target>${NC}"
        return 1
    fi

    local target_file="$OPS_DIR/$target/TARGET.md"
    if [[ ! -f "$target_file" ]]; then
        echo -e "${RED}[!] Target '$target' not found!${NC}"
        echo -e "${YELLOW}    Use 'fox list' to see available targets.${NC}"
        echo -e "${YELLOW}    Use 'fox new $target <ip>' to create it.${NC}"
        return 1
    fi

    # Use less to view, or just cat if we're in a simple terminal
    if command -v less &>/dev/null; then
        less "$target_file"
    else
        cat "$target_file"
        echo ""
        echo -e "${CYAN}Target location: $target_file${NC}"
    fi
}

# ============================================================
# COMMAND: rm — Archive operation
# ============================================================
cmd_rm() {
    local target="$1"
    if [[ -z "$target" ]]; then
        echo -e "${RED}Usage: fox rm <target>${NC}"
        return 1
    fi

    local dir="$OPS_DIR/$target"
    if [[ ! -d "$dir" ]]; then
        echo -e "${RED}[!] Target '$target' not found!${NC}"
        return 1
    fi

    local archive_name="${target}_$(date +%Y%m%d_%H%M%S)"
    local archive_dir="$OPS_DIR/archive/$archive_name"

    mkdir -p "$OPS_DIR/archive"
    mv "$dir" "$archive_dir"
    echo -e "${YELLOW}[!] Target '$target' archived to:${NC}"
    echo -e "${YELLOW}    $archive_dir${NC}"
    echo -e "${YELLOW}    Use 'fox list-archived' to see archived targets.${NC}"
}

# ============================================================
# COMMAND: status — Quick status check
# ============================================================
cmd_status() {
    local target="$1"
    if [[ -z "$target" ]]; then
        echo -e "${RED}Usage: fox status <target>${NC}"
        return 1
    fi

    local dir="$OPS_DIR/$target"
    if [[ ! -d "$dir" ]]; then
        echo -e "${RED}[!] Target '$target' not found!${NC}"
        return 1
    fi

    echo -e "${CYAN}===== $target STATUS =====${NC}"

    local target_file="$dir/TARGET.md"
    if [[ -f "$target_file" ]]; then
        head -10 "$target_file" | grep -E "^(Target|IP|Status|Date)"
    fi
    echo ""

    echo -e "${CYAN}Directory Contents:${NC}"
    ls -la "$dir"
    echo ""

    # Count files in subdirectories
    for sub in recon vulns creds payloads loot exploits; do
        local subdir="$dir/$sub"
        if [[ -d "$subdir" ]]; then
            local count=$(find "$subdir" -type f 2>/dev/null | wc -l)
            echo -e "  ${GREEN}$sub:${NC} $count files"
        fi
    done
}

# ============================================================
# COMMAND: note — Add quick note
# ============================================================
cmd_note() {
    local target="$1"
    shift
    local note_text="$*"

    if [[ -z "$target" || -z "$note_text" ]]; then
        echo -e "${RED}Usage: fox note <target> <note text>${NC}"
        return 1
    fi

    local notes_file="$OPS_DIR/$target/notes.log"
    if [[ ! -d "$OPS_DIR/$target" ]]; then
        echo -e "${RED}[!] Target '$target' not found!${NC}"
        return 1
    fi

    echo "[$(date '+%Y-%m-%d %H:%M')] $note_text" >> "$notes_file"
    echo -e "${GREEN}[+] Note added to $target${NC}"

    echo -e "${YELLOW}    View notes: fox notes $target${NC}"
}

# ============================================================
# COMMAND: notes — Show notes log
# ============================================================
cmd_notes() {
    local target="$1"
    if [[ -z "$target" ]]; then
        echo -e "${RED}Usage: fox notes <target>${NC}"
        return 1
    fi

    local notes_file="$OPS_DIR/$target/notes.log"
    if [[ ! -f "$notes_file" ]]; then
        echo -e "${YELLOW}No notes for $target.${NC}"
        return
    fi

    echo -e "${CYAN}===== $target NOTES =====${NC}"
    cat "$notes_file"
}

# ============================================================
# COMMAND: recon-add — Add recon data (interactive prompt)
# ============================================================
cmd_recon_add() {
    local target="$1"
    if [[ -z "$target" ]]; then
        echo -e "${RED}Usage: fox recon-add <target>${NC}"
        return 1
    fi

    local dir="$OPS_DIR/$target"
    if [[ ! -d "$dir" ]]; then
        echo -e "${RED}[!] Target '$target' not found!${NC}"
        return 1
    fi

    echo -e "${CYAN}Add recon data for $target${NC}"
    echo -e "${YELLOW}Enter data (type 'done' to finish):${NC}"

    local recon_file="$dir/recon/recon_data.txt"
    echo "===== RECON DATA — $(date '+%Y-%m-%d %H:%M') =====" >> "$recon_file"
    echo "" >> "$recon_file"

    while true; do
        read -p "> " line
        [[ "$line" == "done" ]] && break
        echo "$line" >> "$recon_file"
    done

    echo "" >> "$recon_file"
    echo -e "${GREEN}[+] Recon data saved to $recon_file${NC}"
}

# ============================================================
# COMMAND: stash — Interactive save findings
# ============================================================
cmd_stash() {
    local target="$1"
    if [[ -z "$target" ]]; then
        echo -e "${RED}Usage: fox stash <target>${NC}"
        return 1
    fi

    # Cari direktori — cek symlink dulu
    local dir="$OPS_DIR/$target"
    if [[ ! -d "$dir" ]]; then
        echo -e "${RED}[!] Target '$target' not found!${NC}"
        echo -e "${YELLOW}    Use 'fox list' to see available targets.${NC}"
        return 1
    fi

    # Follow symlink kalo ada
    dir=$(readlink -f "$dir" 2>/dev/null || echo "$dir")

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     🦊 FOX — STASH FINDINGS                ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Target:${NC} $target"
    echo -e "${YELLOW}Storage:${NC} $dir"
    echo ""

    while true; do
        echo -e "${BLUE}Pilih tipe temuan:${NC}"
        echo -e "  ${GREEN}1${NC}) recon    — subdomain, port, tech, endpoint"
        echo -e "  ${GREEN}2${NC}) vuln     — vulnerability detail + PoC"
        echo -e "  ${GREEN}3${NC}) creds    — password, hash, token, key"
        echo -e "  ${GREEN}4${NC}) payload  — shell, exploit code, backdoor"
        echo -e "  ${GREEN}5${NC}) loot     — database dump, data, file"
        echo -e "  ${GREEN}6${NC}) exploit  — exploit script, tool output"
        echo -e "  ${GREEN}0${NC}) selesai"
        echo ""
        read -p "  Pilih [1-6, 0=selesai]: " choice

        case "$choice" in
            0) break ;;
            1) local cat="recon" ; local label="RECON" ;;
            2) local cat="vulns" ; local label="VULN" ;;
            3) local cat="creds" ; local label="CREDS" ;;
            4) local cat="payloads" ; local label="PAYLOAD" ;;
            5) local cat="loot" ; local label="LOOT" ;;
            6) local cat="exploits" ; local label="EXPLOIT" ;;
            *) echo -e "${RED}Pilihan gak valid!${NC}" ; continue ;;
        esac

        echo ""
        echo -e "${CYAN}--- $label: Simpan Hasil ---${NC}"
        echo ""

        # Nanya lokasi file
        local subdir="$dir/$cat"
        local default_file="$subdir/${label}_$(date +%Y%m%d_%H%M).txt"

        echo -e "${YELLOW}Lokasi penyimpanan:${NC}"
        echo -e "  ${GREEN}Enter${NC} = ${WHITE}$default_file${NC}"
        echo -e "  Atau input path kustom (relative ke folder ${cat}/)"
        read -p "  File: " custom_file

        local save_path
        if [[ -z "$custom_file" ]]; then
            save_path="$default_file"
        else
            if [[ "$custom_file" == /* ]]; then
                save_path="$custom_file"
            else
                save_path="$subdir/$custom_file"
            fi
        fi

        # Check content source
        echo ""
        echo -e "${YELLOW}Mau input dari mana?${NC}"
        echo -e "  ${GREEN}1${NC}) Ketik langsung (manual)"
        echo -e "  ${GREEN}2${NC}) Copy dari clipboard/file lain"
        echo -e "  ${GREEN}3${NC}) Hasil command (pipe dari tool)"
        read -p "  Pilih [1-3]: " source_type

        echo "" >> "$save_path"
        echo "============================================" >> "$save_path"
        echo "  FOX STASH — $label" >> "$save_path"
        echo "  Target  : $target" >> "$save_path"
        echo "  Date    : $(date '+%Y-%m-%d %H:%M')" >> "$save_path"
        echo "============================================" >> "$save_path"
        echo "" >> "$save_path"

        case "$source_type" in
            1)
                echo -e "${YELLOW}Tulis konten (ketik 'EOF' di baris baru untuk selesai):${NC}"
                while IFS= read -r line; do
                    [[ "$line" == "EOF" ]] && break
                    echo "$line" >> "$save_path"
                done
                ;;
            2)
                echo -e "${YELLOW}Paste konten di sini (ketik 'EOF' di baris baru untuk selesai):${NC}"
                while IFS= read -r line; do
                    [[ "$line" == "EOF" ]] && break
                    echo "$line" >> "$save_path"
                done
                ;;
            3)
                echo -e "${YELLOW}Masukkan output command (ketik 'EOF' di baris baru untuk selesai):${NC}"
                while IFS= read -r line; do
                    [[ "$line" == "EOF" ]] && break
                    echo "$line" >> "$save_path"
                done
                ;;
        esac

        echo "" >> "$save_path"
        echo -e "${GREEN}[+] ${label} saved to: $save_path${NC}"

        # Auto-add note
        local notes_file="$dir/notes.log"
        echo "[$(date '+%Y-%m-%d %H:%M')] STASH ${label} → ${save_path}" >> "$notes_file"

        # Prompt untuk deskripsi singkat
        echo ""
        read -p "  ${YELLOW}Deskripsi singkat (enter = skip):${NC} " desc
        if [[ -n "$desc" ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M')]   ${desc}" >> "$notes_file"
        fi

        echo ""
        echo -e "${GREEN}✅ Done! ${label} saved.${NC}"
        echo ""
    done

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo -e "  ${GREEN}Semua hasil udah distash!${NC}"
    echo -e "  ${YELLOW}  Cek: fox notes $target${NC}"
    echo -e "  ${YELLOW}  Cek: fox status $target${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo ""
}


# ============================================================
# COMMAND: show flow/skills/manifest
# ============================================================
cmd_show() {
    local what="$1"
    local file=""

    case "$what" in
        flow|flow.md)       file="$FOX_HOME/FLOW.md" ;;
        skills|SKILLS.md)   file="$FOX_HOME/SKILLS.md" ;;
        manifest|MANIFEST.md) file="$FOX_HOME/FOX_MANIFEST.md" ;;
        *)
            echo -e "${RED}Available: flow, skills, manifest${NC}"
            return 1
            ;;
    esac

    if [[ -f "$file" ]]; then
        if command -v less &>/dev/null; then
            less "$file"
        else
            cat "$file"
        fi
    else
        echo -e "${RED}[!] File not found: $file${NC}"
    fi
}

# ============================================================
# COMMAND: list-archived — Show archived operations
# ============================================================
cmd_list_archived() {
    local archive_dir="$OPS_DIR/archive"
    if [[ ! -d "$archive_dir" ]]; then
        echo -e "${YELLOW}No archived operations.${NC}"
        return
    fi

    echo -e "${CYAN}ARCHIVED OPERATIONS:${NC}"
    for dir in "$archive_dir"/*/; do
        [[ ! -d "$dir" ]] && continue
        local name=$(basename "$dir")
        echo -e "  ${YELLOW}$name${NC}"
    done
}

# ============================================================
# MAIN
# ============================================================
main() {
    local cmd="$1"
    shift 2>/dev/null

    case "$cmd" in
        new)        cmd_new "$@" ;;
        list)       cmd_list ;;
        open)       cmd_open "$@" ;;
        rm)         cmd_rm "$@" ;;
        status)     cmd_status "$@" ;;
        note)       cmd_note "$@" ;;
        notes)      cmd_notes "$@" ;;
        stash)      cmd_stash "$@" ;;
        recon-add)  cmd_recon_add "$@" ;;
        flow|skills|manifest)
                    cmd_show "$cmd" ;;
        list-archived) cmd_list_archived ;;
        help|--help|-h) show_help ;;
        *)
            if [[ -z "$cmd" ]]; then
                show_help
            else
                echo -e "${RED}Unknown command: $cmd${NC}"
                show_help
            fi
            ;;
    esac
}

# If sourced, define 'fox' function instead
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
    fox() {
        main "$@"
    }
    # Also alias f to fox
    alias f='fox'
else
    main "$@"
fi
