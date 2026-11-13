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
            details.append(title, heading, body, remove);
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
            const comments = await request("/rest/v1/" + table + "?select=id,nickname,body,created_at" + (kind === "tip" ? ",title" : "") + "&order=id.desc&limit=20" + filter);
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
            await rpc("add_site_" + kind, fields);
            form.reset();
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
