import type {Route} from "./+types/home";
import {Invoice} from "~/components/Invoice";
import styles from "./home.module.css";
import {useEffect, useState} from "react";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "New React Router App"},
        {name: "description", content: "Welcome to React Router!"},
    ];
}

export default function Home() {
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [created, setCreated] = useState("");
    const [due, setDue] = useState("");
    const [description, setDescription] = useState("");

    const saveToLocalStorage = () => {
        localStorage.setItem("data", JSON.stringify({invoiceNumber, created, due, description}));
    }

    useEffect(() => {
        //save and load from local storage
        const data = localStorage.getItem("data");
        if (data) {
            const parsedData = JSON.parse(data);
            setInvoiceNumber(parsedData.invoiceNumber);
            setCreated(parsedData.created);
            setDue(parsedData.due);
            setDescription(parsedData.description);
        }
    }, []);

    return (
        <>
            <nav className={`${styles.nav} noPrint`}>
                <div className={`${styles.navContent} w-100 m-auto `}>
                    <h2>
                        DInvoicing
                    </h2>
                </div>
            </nav>
            <br/>
            <div className={`${styles.controls} w-100 m-auto noPrint vstack`}>
                <div className={"hstack"}>
                    <div className="f-column vstack">
                        <label>Factura #</label>
                        <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Creada</label>
                        <input value={created} onChange={(e) => setCreated(e.target.value)}/>
                    </div>
                    <div className="f-column vstack">
                        <label>Fecha de vencimiento</label>
                        <input value={due} onChange={(e) => setDue(e.target.value)}/>
                    </div>
                </div>
                <div className="f-column vstack">
                    <label>Descripcion</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)}/>
                </div>
                <button
                    id="printButton"
                    onClick={() => {
                        saveToLocalStorage();
                        window.print();
                    }}
                >
                    Print invoice
                </button>
            </div>
            <br/>
            <br/>
            <Invoice
                invoiceNumber={invoiceNumber}
                created={created}
                due={due}
                items={[
                    {
                        description: description,
                        quantity: 160,
                        rate: 25
                    }
                ]}
            />
        </>
    );
}
