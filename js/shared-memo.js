(() => {
    // Set these to the Supabase project URL and public publishable key.
    const projectUrl = "https://tzbzxzfcpjrcbrhqgqcq.supabase.co";
    const publishableKey = "sb_publishable_lC2eHvmDCl_WmlGICCDvug_lY7Fhbbk";
    const editor = document.getElementById("memo-text");
    const save = document.getElementById("memo-save");
    const reload = document.getElementById("memo-reload");
    const status = document.getElementById("memo-status");
    let revision;

    if (!projectUrl || !publishableKey) {
        status.textContent = "공용 저장소 연결 대기 중";
        return;
    }

    const api = projectUrl + "/rest/v1/shared_memo?id=eq.1";
    const headers = { apikey: publishableKey };

    async function load() {
        save.disabled = editor.disabled = reload.disabled = true;
        try {
            const response = await fetch(api + "&select=body,revision", { headers, cache: "no-store" });
            if (!response.ok) throw new Error("Load failed");
            const [memo] = await response.json();
            editor.value = memo.body;
            revision = memo.revision;
            reload.hidden = true;
            status.textContent = "";
        } catch {
            reload.hidden = false;
            status.textContent = "메모를 불러오지 못했습니다.";
        } finally {
            save.disabled = editor.disabled = revision === undefined;
            reload.disabled = false;
        }
    }

    save.addEventListener("click", async () => {
        save.disabled = editor.disabled = reload.disabled = true;
        try {
            const response = await fetch(api + "&revision=eq." + revision, {
                method: "PATCH",
                headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
                body: JSON.stringify({ body: editor.value, revision: revision + 1 })
            });
            if (!response.ok) throw new Error("Save failed");
            const [memo] = await response.json();
            if (!memo) {
                reload.hidden = false;
                status.textContent = "다른 방문자가 먼저 저장했습니다. 작성한 내용을 복사한 뒤 최신 메모를 불러오세요.";
                return;
            }
            revision = memo.revision;
            status.textContent = "저장했습니다.";
        } catch {
            status.textContent = "저장하지 못했습니다. 다시 시도해 주세요.";
        } finally {
            save.disabled = editor.disabled = reload.disabled = false;
        }
    });

    reload.addEventListener("click", load);
    load();
})();
