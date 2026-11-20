import type {RecordEvidence} from "~/lib/data-model";
import {useLang} from "~/hooks/useLang";
export function RecordSources({record}: {record: RecordEvidence}) {
    const {t, money} = useLang();
    if (!record.notes && !record.sourceDocuments?.length && !record.taxReporting) return null;
    return <details className="noPrint">
        <summary>{t("Sources and notes")}</summary>
        <div className="vstack">
            {record.notes && <p>{record.notes}</p>}
            {record.taxReporting && <p>{t("Amount recorded in tax ledger")}: {money(record.taxReporting.amount, record.taxReporting.currency)}<br/>{record.taxReporting.source}</p>}
            {record.sourceDocuments?.map(source => <p key={source} style={{overflowWrap: "anywhere"}}>{source}</p>)}
        </div>
    </details>;
}
