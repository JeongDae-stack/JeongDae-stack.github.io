(() => {
    const url = "https://tzbzxzfcpjrcbrhqgqcq.supabase.co";
    const apikey = "sb_publishable_lC2eHvmDCl_WmlGICCDvug_lY7Fhbbk";
    const form = document.querySelector("#commentForm");
    const admin = document.querySelector("#commentAdmin");
    const logout = document.querySelector("#commentLogout");
    const list = document.querySelector("#commentList");
    const status = document.querySelector("#commentStatus");
    const more = document.querySelector("#commentMore");
    let token;
    let cursor;
    let loading = false;
    const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

    async function request(path, body, accessToken) {
        const headers = { apikey };
        if (accessToken) headers.Authorization = "Bearer " + accessToken;
        if (body) headers["Content-Type"] = "application/json";
        const response = await fetch(url + path, {
            method: body ? "POST" : "GET", headers, body: body && JSON.stringify(body), cache: "no-store"
        });
        if (!response.ok) throw new Error("Request failed");
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    function rpc(name, body, accessToken) {
        return request("/rest/v1/rpc/" + name, body, accessToken);
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
            const adminToken = token;
            const password = adminToken ? null : window.prompt("댓글을 등록할 때 정한 삭제 비밀번호를 입력하세요.");
            if (adminToken ? !window.confirm("이 댓글을 삭제할까요?") : !password) return;
            remove.disabled = true;
            try {
                if (await rpc("delete_site_comment", { comment_id: comment.id, password }, adminToken)) {
                    row.remove();
                    status.textContent = "댓글을 삭제했습니다.";
                } else status.textContent = "비밀번호가 일치하지 않거나 이미 삭제된 댓글입니다.";
            } catch {
                status.textContent = "삭제하지 못했습니다. 관리자 세션이 만료됐다면 다시 로그인해 주세요.";
            } finally {
                remove.disabled = false;
            }
        };
        row.append(heading, body, remove);
        return row;
    }

    async function load(append = false) {
        if (loading) return;
        loading = more.disabled = true;
        try {
            const filter = append ? "&id=lt." + cursor : "";
            const comments = await request("/rest/v1/site_comments?select=id,nickname,body,created_at&order=id.desc&limit=20" + filter);
            if (!append) list.replaceChildren();
            list.append(...comments.map(render));
            cursor = comments.at(-1)?.id;
            more.hidden = comments.length < 20;
            status.textContent = list.childElementCount ? "" : "아직 댓글이 없습니다.";
        } catch {
            status.textContent = "댓글을 불러오지 못했습니다.";
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
            await rpc("add_site_comment", fields);
            form.reset();
            await load();
        } catch {
            status.textContent = "댓글을 등록하지 못했습니다. 입력을 확인해 주세요.";
        } finally {
            button.disabled = false;
        }
    };

    admin.onsubmit = async event => {
        event.preventDefault();
        const button = admin.querySelector("button");
        button.disabled = true;
        try {
            const session = await request("/auth/v1/token?grant_type=password", Object.fromEntries(new FormData(admin)));
            if (!await rpc("is_comment_admin", {}, session.access_token)) throw new Error("Not an admin");
            token = session.access_token;
            admin.reset();
            admin.hidden = true;
            logout.hidden = false;
            status.textContent = "관리자로 로그인했습니다.";
        } catch {
            status.textContent = "관리자로 로그인하지 못했습니다.";
        } finally {
            button.disabled = false;
        }
    };

    logout.onclick = () => {
        token = undefined;
        admin.hidden = false;
        logout.hidden = true;
        status.textContent = "관리자 모드를 종료했습니다.";
    };
    more.onclick = () => load(true);
    document.addEventListener("comments:open", () => load());
})();
