import {useState} from "react";
import {useLang} from "~/hooks/useLang";
import {runTool, type Profile, type ProfileDeletionPreview} from "~/lib/database";
import {recordVersion} from "~/lib/record-version";

export function ProfileActions({profile, count, disabled, hasUnsavedEdits, perform, confirmDiscard, onChanged}: {
    profile: Profile; count: number; disabled: boolean; hasUnsavedEdits: boolean;
    perform: (action: () => Promise<void>) => Promise<void>;
    confirmDiscard: () => boolean; onChanged: (deleted: boolean) => Promise<void>;
}) {
    const {t} = useLang();
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(profile.name);
    const [renameVersion, setRenameVersion] = useState(recordVersion(profile));
    const [preview, setPreview] = useState<ProfileDeletionPreview | null>(null);
    const [requestId, setRequestId] = useState("");
    return <fieldset disabled={disabled || hasUnsavedEdits} className="vstack">
        <div className="toolbar">
            <button type="button" className="secondary compact" onClick={() => {
                setName(profile.name); setRenameVersion(recordVersion(profile)); setRenaming(true); setPreview(null);
            }}>{t("Rename profile")}</button>
            <button type="button" className="secondary compact" disabled={count <= 1} onClick={() => void perform(async () => {
                setPreview(await runTool<ProfileDeletionPreview>("preview_profile_deletion", {profileId: profile.id}));
                setRequestId(crypto.randomUUID()); setRenaming(false);
            })}>{t("Delete profile")}</button>
        </div>
        {hasUnsavedEdits && <p className="settings-description">{t("Save or discard profile edits before managing this profile.")}</p>}
        {count <= 1 && <p className="settings-description">{t("Keep at least one profile.")}</p>}
        {renaming && <form className="vstack" onSubmit={event => {
            event.preventDefault();
            void perform(async () => {
                await runTool("rename_profile", {profileId: profile.id, name, expectedVersion: renameVersion});
                await onChanged(false); setRenaming(false);
            });
        }}>
            <label className="form-field">{t("Profile name")}
                <input autoFocus required maxLength={10000} value={name} onChange={event => setName(event.target.value)}/>
            </label>
            <div className="toolbar">
                <button type="submit" disabled={!name.trim()}>{t("Save profile")}</button>
                <button type="button" className="secondary" onClick={() => setRenaming(false)}>{t("Cancel")}</button>
            </div>
        </form>}
        {preview && <div className="vstack" role="group" aria-label={t("Delete profile")}>
            <p>{t("Delete {profile}, its {invoices} invoices and {expenses} expenses? This cannot be undone.", {
                profile: preview.name, invoices: preview.invoiceCount, expenses: preview.expenseCount ?? 0,
            })}</p>
            {!preview.canDelete && <p>{t("Keep at least one profile.")}</p>}
            <div className="toolbar">
                <button type="button" disabled={!preview.canDelete} onClick={() => {
                    if (!confirmDiscard()) return;
                    void perform(async () => {
                        await runTool("delete_profile", {profileId: preview.profileId, expectedVersion: preview.version, requestId});
                        await onChanged(true); setPreview(null);
                    });
                }}>{t("Delete permanently")}</button>
                <button type="button" className="secondary" onClick={() => setPreview(null)}>{t("Cancel")}</button>
            </div>
        </div>}
    </fieldset>;
}
