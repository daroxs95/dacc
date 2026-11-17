import styles from "./Invoice.module.css";
import {useEffect, useRef, useState, type CSSProperties} from "react";
import {type Lang, useLang} from "~/hooks/useLang";
import {decimalAmount, invoiceAmount, invoiceCents} from "~/lib/money";

type Item = {
    description: string;
    quantity: number;
    rate: number;
}

interface InvoiceProps {
    created: string;
    due: string;
    invoiceNumber: string;
    items: Item[];
    showLogo?: boolean;
    company?: Company;
    companyToBill?: Company;
    paid?: boolean;
    language: Lang;
}

export function Invoice({created, due, invoiceNumber, items, showLogo, company, paid, companyToBill, language}: InvoiceProps) {
    const frame = useRef<HTMLDivElement>(null);
    const sheet = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const container = frame.current;
        const page = sheet.current;
        if (!container || !page) return;
        const resize = () => {
            // Layout width is untransformed, so zoom and column resizing never
            // change the document's 210 x 297 mm geometry or its line wrapping.
            const width = parseFloat(getComputedStyle(page).width);
            if (width > 0) setScale(container.clientWidth / width);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();
        return () => observer.disconnect();
    }, []);

    const total = Number(decimalAmount(items.reduce((acc, curr) => acc + invoiceCents(curr.quantity, curr.rate), 0n)));

    const {t, money, number} = useLang(language);

    return (
        <div ref={frame} className={styles.previewFrame} style={{"--preview-scale": scale} as CSSProperties}>
        <div ref={sheet} className={styles.invoiceBox} lang={language}>
            <table cellPadding="0" cellSpacing="0">
                <tbody>
                <tr className={styles.top}>
                    <td colSpan={4}>
                        <table>
                            <tbody>
                            <tr>
                                <td className={styles.title}>
                                    {showLogo && <img
                                        src="/darologo.png"
                                        alt={t("Company logo")}
                                        style={{
                                            width: "100%",
                                            maxWidth: "80px"
                                        }}
                                    />}
                                </td>

                                <td>
                                    {t("Invoice")} #: {invoiceNumber}<br/>
                                    {t("Created")}: {created}<br/>
                                    {t("Due")}: {due}
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>

                <tr className={styles.information}>
                    <td colSpan={4}>
                        <table>
                            <tbody><tr>
                            <th></th>
                            <th>{t("Bill to")}</th>
                            </tr>
                            <tr>
                                <td>
                                    {company?.name}<br/>
                                    {company?.address}<br/>
                                    {company?.city}, {company?.country}, {company?.postalCode}<br/>
                                    {company?.email}
                                </td>

                                <td>
                                    {companyToBill?.name}<br/>
                                    {companyToBill?.address}<br/>
                                    {companyToBill?.city}, {companyToBill?.country}, {companyToBill?.postalCode}<br/>
                                    {companyToBill?.email}
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>

                {/*<tr className={styles.heading}>*/}
                {/*    <td>Método de pago</td>*/}

                {/*    <td> #</td>*/}
                {/*</tr>*/}

                {/*<tr className={styles.details}>*/}
                {/*    <td>Check</td>*/}

                {/*    <td>1000</td>*/}
                {/*</tr>*/}

                <tr className={styles.heading}>
                    <td>{t("Item & Description")}</td>
                    <td>{t("Amount")}</td>
                    <td>{t("Rate")}</td>
                    <td>{t("Total")}</td>
                </tr>

                {items.map((item, index) => (
                    <tr key={index} className={styles.item}>
                        <td>{item.description}</td>
                        <td>{number(item.quantity)}</td>
                        <td>{money(item.rate)}</td>
                        <td>{money(invoiceAmount(item.quantity, item.rate))}</td>
                    </tr>
                ))}

                <tr className={styles.total}>
                    <td></td>
                    <td></td>
                    <td></td>

                    <td>
                        {t("Total")}: {money(total)}
                    </td>
                    
                </tr>
                {paid &&
                    (<>
                        <tr className={styles.item}>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>
                                {t("Payment")}: {money(-total)}
                            </td>
                        </tr>
                        <tr className={styles.total}>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>
                                {t("Balance due")}: {money(0)}
                            </td>
                        </tr>
                    </>)
                }
                </tbody>
            </table>
        </div>
        </div>
    )
}
