async function encodeTipImage(file) {
    if (file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Unsupported image");
    }
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.8, 0.65, 0.45, 0.25, 0.1]) {
            const data = canvas.toDataURL("image/jpeg", quality);
            if (data.length <= 450000) return data;
        }
        throw new Error("Image too large");
    } finally {
        bitmap.close();
    }
}

function mountDiscussion({ prefix, table, kind, tab, label }) {
    const url = "https://tzbzxzfcpjrcbrhqgqcq.supabase.co";
    const apikey = "sb_publishable_lC2eHvmDCl_WmlGICCDvug_lY7Fhbbk";
    const form = document.getElementById(prefix + "Form");
    const list = document.getElementById(prefix + "List");
    const status = document.getElementById(prefix + "Status");
    const more = document.getElementById(prefix + "More");
    let cursor;
    let loading = false;
    const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

    async function request(path, body) {
        const headers = { apikey };

        if (body) headers["Content-Type"] = "application/json";
        const response = await fetch(url + path, {
            method: body ? "POST" : "GET", headers, body: body && JSON.stringify(body), cache: "no-store"
        });
        if (!response.ok) throw new Error("Request failed");
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    function rpc(name, body) {
        return request("/rest/v1/rpc/" + name, body);
    }

    function render(comment) {
        const row = document.createElement("article");
        const heading = document.createElement("strong");
        heading.textContent = comment.nickname + " · " + date.format(new Date(comment.created_at));
        const body = document.createElement("p");
        body.textContent = comment.body;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "삭제";
        remove.onclick = async () => {
            const password = window.prompt("삭제 비밀번호를 입력하세요.");
            if (!password) return;
            remove.disabled = true;
            try {
                if (await rpc("delete_site_" + kind, { [kind + "_id"]: comment.id, password })) {
                    row.remove();
                    status.textContent = label + "을 삭제했습니다.";
                } else status.textContent = "비밀번호가 일치하지 않거나 이미 삭제된 글입니다.";
            } catch {
                status.textContent = "삭제하지 못했습니다. 다시 시도해 주세요.";
            } finally {
                remove.disabled = false;
            }
        };
        if (kind === "tip") {
            const details = document.createElement("details");
            const title = document.createElement("summary");
            title.textContent = comment.title;
            title.append(heading);
            details.append(title, body, remove);
            if (comment.has_image) {
                let imageLoaded = false;
                details.addEventListener("toggle", async () => {
                    if (!details.open || imageLoaded) return;
                    imageLoaded = true;
                    try {
                        const [tip] = await request("/rest/v1/site_tips?select=image_data&id=eq." + comment.id);
                        if (!tip?.image_data?.startsWith("data:image/jpeg;base64,")) return;
                        const image = document.createElement("img");
                        image.src = tip.image_data;
                        image.alt = comment.title + " 첨부 이미지";
                        image.className = "tip-image";
                        remove.before(image);
                    } catch {
                        imageLoaded = false;
                        status.textContent = "첨부 이미지를 불러오지 못했습니다.";
                    }
                });
            }
            row.append(details);
        } else {
            row.append(heading, body, remove);
        }
        return row;
    }

    async function load(append = false) {
        if (loading) return;
        loading = more.disabled = true;
        try {
            const filter = append ? "&id=lt." + cursor : "";
            const comments = await request("/rest/v1/" + table + "?select=id,nickname,body,created_at" + (kind === "tip" ? ",title,has_image" : "") + "&order=id.desc&limit=20" + filter);
            if (!append) list.replaceChildren();
            list.append(...comments.map(render));
            cursor = comments.at(-1)?.id;
            more.hidden = comments.length < 20;
            status.textContent = list.childElementCount ? "" : "아직 " + label + "이 없습니다.";
        } catch {
            status.textContent = label + "을 불러오지 못했습니다.";
        } finally {
            loading = more.disabled = false;
        }
    }

    form.onsubmit = async event => {
        event.preventDefault();
        const fields = Object.fromEntries(new FormData(form));
        if (new TextEncoder().encode(fields.password).length > 72) {
            status.textContent = "삭제 비밀번호가 너무 깁니다.";
            return;
        }
        const button = form.querySelector("button");
        button.disabled = true;
        try {
            if (kind === "tip") {
                const file = fields.image;
                delete fields.image;
                if (file?.size) {
                    try {
                        fields.image_data = await encodeTipImage(file);
                    } catch {
                        status.textContent = "10MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요.";
                        return;
                    }
                }
            }
            await rpc("add_site_" + kind, fields);
            form.reset();
            if (kind === "tip") setTipFormOpen(false);
            await load();
        } catch {
            status.textContent = label + "을 등록하지 못했습니다. 입력을 확인해 주세요.";
        } finally {
            button.disabled = false;
        }
    };

    more.onclick = () => load(true);
    document.addEventListener(tab + ":open", () => load());
}

mountDiscussion({ prefix: "comment", table: "site_comments", kind: "comment", tab: "comments", label: "댓글" });
mountDiscussion({ prefix: "tip", table: "site_tips", kind: "tip", tab: "tips", label: "게시글" });

function setTipFormOpen(open) {
    const form = document.getElementById("tipForm");
    const write = document.getElementById("tipWrite");
    form.hidden = !open;
    write.setAttribute("aria-expanded", String(open));
    if (open) form.elements.title.focus();
    else write.focus();
}

document.getElementById("tipWrite").onclick = () => setTipFormOpen(document.getElementById("tipForm").hidden);
document.getElementById("tipCancel").onclick = () => setTipFormOpen(false);